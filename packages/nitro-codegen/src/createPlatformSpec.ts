import type { PlatformSpec } from 'react-native-nitro-modules'
import type { Language, Platform } from './getPlatformSpecs.js'
import {
  ts,
  Type,
  type InterfaceDeclaration,
  type MethodSignature,
  type ParameterDeclaration,
  type PropertySignature,
} from 'ts-morph'
import { getNodeName } from './getNodeName.js'

interface File {
  name: string
  content: string
  language: Language
}

interface CodeNode {
  /**
   * Get the code of this code node (e.g. property, method) in the given language.
   */
  getCode(language: Language): string
  /**
   * Get all extra definition files this code node needs (e.g. extra type/struct declarations
   * for complex types), or `[]` if none are required (e.g. if this uses primitive types only)
   */
  getDefinitionFiles(language: Language): File[]
}

function createFileMetadataString(filename: string): string {
  const now = new Date()
  return `
///
/// ${filename}
/// ${now.toDateString()}
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/react-native-nitro
/// Copyright © ${now.getFullYear()} Marc Rousavy @ Margelo
///
`
}

function toReferenceType(type: string): `const ${typeof type}&` {
  return `const ${type}&`
}

function capitalizeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function indent(string: string, indentation: string): string {
  return string.replaceAll('\n', `\n${indentation}`)
}

function joinToIndented(array: string[], indentation: string = '    '): string {
  return array.join('\n').replaceAll('\n', `\n${indentation}`)
}

function removeDuplicates<T>(array: T[], equals: (a: T, b: T) => boolean): T[] {
  const result: T[] = []
  for (const item of array) {
    if (result.some((r) => equals(r, item))) {
      // skip it, it's a duplicate
    } else {
      result.push(item)
    }
  }
  return result
}

function isSymbol(type: Type, symbolName: string): boolean {
  const symbol = type.getSymbol()
  if (symbol?.getName() === symbolName) {
    return true
  }
  const aliasSymbol = type.getAliasSymbol()
  if (aliasSymbol?.getName() === symbolName) {
    return true
  }
  return false
}

function isPromise(type: Type): boolean {
  return isSymbol(type, 'Promise')
}

function isRecord(type: Type): boolean {
  return isSymbol(type, 'Record')
}

function isArrayBuffer(type: Type): boolean {
  return isSymbol(type, 'ArrayBuffer')
}

interface CppMethodSignature {
  returnType: TSType | VoidType
  parameters: NamedTSType[]
  rawName: string
  name: string
  type: 'getter' | 'setter' | 'method'
}

interface EnumMember {
  name: string
  value: number
}

class VoidType implements CodeNode {
  constructor() {}

  getCode(): string {
    return 'void'
  }

  getDefinitionFiles(): File[] {
    return []
  }
}

class TSType implements CodeNode {
  readonly type: Type
  readonly isOptional: boolean
  readonly passByConvention: 'by-reference' | 'by-value'
  private readonly cppName: string
  private readonly extraFiles: File[]

  private readonly baseTypes: TSType[]
  private readonly referencedTypes: TSType[]

  constructor(type: Type, isOptional: boolean) {
    this.type = type
    this.isOptional = isOptional
    this.baseTypes = []
    this.referencedTypes = []
    this.extraFiles = []

    if (type.isNull() || type.isUndefined()) {
      this.cppName = 'std::nullptr_t'
      this.passByConvention = 'by-value'
    } else if (type.isBoolean() || type.isBooleanLiteral()) {
      this.cppName = 'bool'
      this.passByConvention = 'by-value'
    } else if (type.isNumber() || type.isNumberLiteral()) {
      this.cppName = 'double'
      this.passByConvention = 'by-value'
    } else if (type.isString()) {
      this.cppName = 'std::string'
      this.passByConvention = 'by-reference'
    } else if (type.isBigInt() || type.isBigIntLiteral()) {
      this.cppName = 'int64_t'
      this.passByConvention = 'by-value'
    } else if (type.isVoid()) {
      this.cppName = 'void'
      this.passByConvention = 'by-value'
    } else if (type.isArray() || type.isTuple()) {
      const arrayElementType = type.getArrayElementTypeOrThrow()
      const elementType = new TSType(
        arrayElementType,
        arrayElementType.isNullable()
      )
      this.cppName = `std::vector<${elementType.cppName}>`
      this.passByConvention = 'by-reference'
      this.referencedTypes.push(elementType)
    } else if (type.getCallSignatures().length > 0) {
      // It's a function!
      const callSignatures = type.getCallSignatures()
      const callSignature = callSignatures[0]
      if (callSignatures.length !== 1 || callSignature == null) {
        throw new Error(
          `Function overloads are not supported in Nitrogen! (in ${type.getText()})`
        )
      }

      const funcReturnType = callSignature.getReturnType()
      const returnType = new TSType(funcReturnType, funcReturnType.isNullable())
      const parameters = callSignature.getParameters().map((p) => {
        const declaration = p.getValueDeclarationOrThrow()
        const t = p.getTypeAtLocation(declaration)
        return new TSType(t, p.isOptional() || t.isNullable())
      })
      const cppParamsArgs = parameters.map((p) => p.cppName).join(', ')

      this.cppName = `std::function<${returnType.cppName}(${cppParamsArgs})>`
      this.passByConvention = 'by-reference'
      this.referencedTypes.push(returnType, ...parameters)
    } else if (isPromise(type)) {
      // It's a Promise!
      const typename = type.getSymbolOrThrow().getName()
      const typeArguments = type.getTypeArguments()
      const promiseResolvingType = typeArguments[0]
      if (typeArguments.length !== 1 || promiseResolvingType == null) {
        throw new Error(
          `Type ${typename} looks like a Promise, but has ${typeArguments.length} type arguments instead of 1 (<T>)!`
        )
      }
      const resolvingType = new TSType(
        promiseResolvingType,
        promiseResolvingType.isNullable()
      )
      this.cppName = `std::future<${resolvingType.cppName}>`
      this.passByConvention = 'by-reference'
      this.referencedTypes.push(resolvingType)
    } else if (isRecord(type)) {
      // Record<K, V> -> unordered_map<K, V>
      const typename = type.getAliasSymbolOrThrow().getName()
      const typeArgs = type.getAliasTypeArguments()
      const [keyTypeT, valueTypeT] = typeArgs
      if (typeArgs.length !== 2 || keyTypeT == null || valueTypeT == null) {
        throw new Error(
          `Type ${typename} looks like a Record, but has ${typeArgs.length} type arguments instead of 2 (<K, V>)!`
        )
      }
      const keyType = new TSType(keyTypeT, false)
      const valueType = new TSType(valueTypeT, false)
      this.cppName = `std::unordered_map<${keyType.cppName}, ${valueType.cppName}>`
      this.passByConvention = 'by-reference'
      this.referencedTypes.push(keyType, valueType)
    } else if (isArrayBuffer(type)) {
      // ArrayBuffer
      this.cppName = 'std::shared_ptr<ArrayBuffer>'
      this.passByConvention = 'by-value'
    } else if (type.isEnum()) {
      // It is an enum. We need to generate enum interface
      this.passByConvention = 'by-value'
      const typename = type.getSymbolOrThrow().getName()
      this.cppName = typename
      const enumValues: EnumMember[] = []
      const declaration = type.getSymbolOrThrow().getValueDeclarationOrThrow()
      const enumDeclaration = declaration.asKindOrThrow(
        ts.SyntaxKind.EnumDeclaration
      )
      for (const enumMember of enumDeclaration.getMembers()) {
        const name = enumMember.getName()
        const value = enumMember.getValue()
        if (typeof value !== 'number') {
          throw new Error(
            `Enum member ${typename}.${name} is ${value} (${typeof value}), which cannot be represented in C++ enums.\n` +
              `Each enum member must be a number! If you want to use strings, use TypeScript unions ("a" | "b") instead!`
          )
        }
        enumValues.push({
          name: enumMember.getName(),
          value: value,
        })
      }
      const cppEnumMembers = enumValues.map((m) => `${m.name} = ${m.value},`)

      const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

#include <NitroModules/JSIConverter.hpp>

enum class ${typename} {
  ${joinToIndented(cppEnumMembers, '  ')}
};

namespace margelo::nitro {

  // C++ ${typename} <> JS ${typename} (enum)
  template <>
  struct JSIConverter<${typename}> {
    static ${typename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      int enumValue = JSIConverter<int>::fromJSI(runtime, arg);
      return static_cast<${typename}>(enumValue);
    }
    static jsi::Value toJSI(jsi::Runtime& runtime, ${typename} arg) {
      int enumValue = static_cast<int>(arg);
      return JSIConverter<int>::toJSI(enumValue);
    }
  };

} // namespace margelo::nitro
              `
      this.extraFiles.push({
        language: 'c++',
        name: `${typename}.hpp`,
        content: cppCode,
      })
    } else if (type.isUnion()) {
      const symbol = type.getAliasSymbol()
      if (symbol == null) {
        // It is an inline union instead of a separate type declaration!
        throw new Error(
          `Inline union types ("${type.getText()}") are not supported by Nitrogen!\n` +
            `Extract the union to a separate type, and re-run nitrogen!`
        )
      }

      const typename = symbol.getName()
      const enumValues = type.getUnionTypes().map((t) => {
        if (t.isStringLiteral()) {
          const literalValue = t.getLiteralValueOrThrow()
          if (typeof literalValue !== 'string')
            throw new Error(
              `${typename}: Value "${literalValue}" is not a string - it is ${typeof literalValue}!`
            )
          return literalValue
        } else {
          throw new Error(
            `${typename}: Value "${t.getText()}" is not a string literal - it cannot be represented in a C++ enum!`
          )
        }
      })
      this.passByConvention = 'by-value'
      this.cppName = typename
      const cppEnumMembers = enumValues.map((m) => `${m},`)
      const cppFromJsiHashCases = enumValues
        .map((v) =>
          `case hashString("${v}", ${v.length}): return ${typename}::${v};`.trim()
        )
        .join('\n')
      const cppToJsiCases = enumValues
        .map(
          (v) =>
            `case ${typename}::${v}: return JSIConverter<std::string>::toJSI(runtime, "${v}");`
        )
        .join('\n')

      const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

#include <NitroModules/Hash.hpp>
#include <NitroModules/JSIConverter.hpp>

enum class ${typename} {
  ${joinToIndented(cppEnumMembers, '  ')}
};

namespace margelo::nitro {

  // C++ ${typename} <> JS ${typename} (union)
  template <>
  struct JSIConverter<${typename}> {
    static ${typename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      std::string unionValue = JSIConverter<std::string>::fromJSI(runtime, arg);
      switch (hashString(unionValue.c_str(), unionValue.size())) {
        ${indent(cppFromJsiHashCases, '        ')}
        default:
          throw std::runtime_error("Cannot convert " + unionValue + " to ${typename} - invalid value!");
      }
    }
    static jsi::Value toJSI(jsi::Runtime& runtime, ${typename} arg) {
      switch (arg) {
        ${indent(cppToJsiCases, '        ')}
        default:
          throw std::runtime_error("Cannot convert ${typename} to JS - invalid value: "
                                     + std::to_string(static_cast<int>(arg)) + "!");
      }
    }
  };

} // namespace margelo::nitro
              `
      this.extraFiles.push({
        language: 'c++',
        name: `${typename}.hpp`,
        content: cppCode,
      })
    } else if (type.isInterface()) {
      // It references another interface/type, either a simple struct, or another HybridObject
      const typename = type.getSymbolOrThrow().getName()

      const isHybridObject = type
        .getBaseTypes()
        .some((t) => t.getText().includes('HybridObject'))

      if (isHybridObject) {
        // It is another HybridObject being referenced!
        this.cppName = `std::shared_ptr<${typename}>`
        this.passByConvention = 'by-value' // shared_ptr should be passed by value
      } else {
        // It is a simple struct being referenced.
        this.cppName = typename
        this.passByConvention = 'by-reference'
        const cppProperties: NamedTSType[] = []
        for (const prop of type.getProperties()) {
          // recursively resolve types for each property of the referenced type
          const declaration = prop.getValueDeclarationOrThrow()
          const propType = prop.getTypeAtLocation(declaration)
          const refType = new NamedTSType(
            propType,
            prop.isOptional(),
            prop.getName()
          )
          cppProperties.push(refType)
          this.referencedTypes.push(refType)
        }
        const cppStructProps = cppProperties.map(
          (p) => `${p.getCode()} ${p.name};`
        )
        const cppFromJsiProps = cppProperties.map(
          (p) =>
            `.${p.name} = JSIConverter<${p.getCode()}>::fromJSI(runtime, obj.getProperty(runtime, "${p.name}")),`
        )
        const cppToJsiCalls = cppProperties.map(
          (p) =>
            `obj.setProperty(runtime, "${p.name}", JSIConverter<${p.getCode()}>::toJSI(runtime, arg.${p.name}));`
        )

        const extraFiles = this.referencedTypes.flatMap((r) =>
          r.getDefinitionFiles()
        )
        const cppExtraIncludes = extraFiles.map((f) => `#include "${f.name}"`)

        const cppCode = `
${createFileMetadataString(`${typename}.hpp`)}

#pragma once

#include <NitroModules/JSIConverter.hpp>

${cppExtraIncludes.join('\n')}

struct ${typename} {
public:
  ${joinToIndented(cppStructProps, '  ')}
};

namespace margelo::nitro {

  // C++ ${typename} <> JS ${typename} (object)
  template <>
  struct JSIConverter<${typename}> {
    static ${typename} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      jsi::Object obj = arg.asObject(runtime);
      return ${typename} {
        ${joinToIndented(cppFromJsiProps, '        ')}
      };
    }
    static jsi::Value toJSI(jsi::Runtime& runtime, const ${typename}& arg) {
      jsi::Object obj(runtime);
      ${joinToIndented(cppToJsiCalls, '      ')}
      return obj;
    }
  };

} // namespace margelo::nitro
        `
        this.extraFiles.push({
          language: 'c++',
          name: `${typename}.hpp`,
          content: cppCode,
        })
      }
    } else if (type.isStringLiteral()) {
      throw new Error(
        `String literal ${type.getText()} cannot be represented in C++ because it is ambiguous between a string and a discriminating union enum.`
      )
    } else {
      throw new Error(
        `The TypeScript type "${type.getText()}" cannot be represented in C++!`
      )
    }
  }

  getCode(): string {
    if (this.isOptional) {
      return `std::optional<${this.cppName}>`
    } else {
      return this.cppName
    }
  }

  getDefinitionFiles(): File[] {
    const extra = this.extraFiles
    const inheritedDefinitionFiles = this.baseTypes.flatMap((b) =>
      b.getDefinitionFiles()
    )
    const referencedDefinitionFiles = this.referencedTypes.flatMap((r) =>
      r.getDefinitionFiles()
    )
    const allFiles = [
      ...extra,
      ...inheritedDefinitionFiles,
      ...referencedDefinitionFiles,
    ]
    return removeDuplicates(allFiles, (a, b) => a.name === b.name)
  }
}

class NamedTSType extends TSType {
  readonly name: string

  constructor(type: Type, isOptional: boolean, name: string) {
    super(type, isOptional)
    this.name = name
  }
}

class Property implements CodeNode {
  readonly name: string
  readonly type: NamedTSType
  readonly isReadonly: boolean

  constructor(prop: PropertySignature) {
    this.name = prop.getName()
    this.isReadonly = prop.hasModifier(ts.SyntaxKind.ReadonlyKeyword)
    const type = prop.getTypeNodeOrThrow().getType()
    const isOptional = prop.hasQuestionToken() || type.isNullable()
    this.type = new NamedTSType(type, isOptional, this.name)
  }

  get cppSignatures(): CppMethodSignature[] {
    const signatures: CppMethodSignature[] = []
    const capitalizedName = capitalizeName(this.name)
    // getter
    signatures.push({
      returnType: this.type,
      rawName: this.name,
      name: `get${capitalizedName}`,
      parameters: [],
      type: 'getter',
    })
    if (!this.isReadonly) {
      // setter
      signatures.push({
        returnType: new VoidType(),
        rawName: this.name,
        name: `set${capitalizedName}`,
        parameters: [this.type],
        type: 'setter',
      })
    }
    return signatures
  }

  getDefinitionFiles(): File[] {
    return removeDuplicates(
      this.type.getDefinitionFiles(),
      (a, b) => a.name === b.name
    )
  }

  getCode(language: Language): string {
    switch (language) {
      case 'c++':
        const signatures = this.cppSignatures
        const codeLines = signatures.map((s) => {
          const params = s.parameters.map((p) => {
            const paramType =
              p.passByConvention === 'by-reference'
                ? toReferenceType(p.getCode())
                : p.getCode()
            return `${paramType} ${p.name}`
          })
          return `virtual ${s.returnType.getCode()} ${s.name}(${params.join(', ')}) = 0;`
        })
        return codeLines.join('\n')
      default:
        throw new Error(
          `Language ${language} is not yet supported for properties!`
        )
    }
  }
}

class Parameter implements CodeNode {
  readonly name: string
  readonly type: NamedTSType

  constructor(param: ParameterDeclaration) {
    this.name = param.getName()
    const type = param.getTypeNodeOrThrow().getType()
    const isOptional =
      param.hasQuestionToken() || param.isOptional() || type.isNullable()
    this.type = new NamedTSType(type, isOptional, this.name)
  }

  getCode(language: Language): string {
    switch (language) {
      case 'c++':
        return `${this.type.getCode()} ${this.name}`
      default:
        throw new Error(
          `Language ${language} is not yet supported for parameters!`
        )
    }
  }

  getDefinitionFiles(): File[] {
    return removeDuplicates(
      this.type.getDefinitionFiles(),
      (a, b) => a.name === b.name
    )
  }
}

class Method implements CodeNode {
  readonly name: string
  readonly returnType: TSType
  readonly parameters: Parameter[]

  constructor(prop: MethodSignature) {
    this.name = getNodeName(prop)
    const returnType = prop.getReturnTypeNodeOrThrow()
    const type = returnType.getType()
    const isOptional = type.isNullable()
    this.returnType = new TSType(type, isOptional)
    this.parameters = prop.getParameters().map((p) => new Parameter(p))
  }

  get cppSignature(): CppMethodSignature {
    return {
      rawName: this.name,
      name: this.name,
      returnType: this.returnType,
      parameters: this.parameters.map((p) => p.type),
      type: 'method',
    }
  }

  getCode(language: Language): string {
    switch (language) {
      case 'c++':
        const signature = this.cppSignature
        const params = signature.parameters.map((p) => {
          const paramType =
            p.passByConvention === 'by-reference'
              ? toReferenceType(p.getCode())
              : p.getCode()
          return `${paramType} ${p.name}`
        })
        return `virtual ${signature.returnType.getCode()} ${signature.name}(${params.join(', ')}) = 0;`
      default:
        throw new Error(
          `Language ${language} is not yet supported for property getters!`
        )
    }
  }

  getDefinitionFiles(): File[] {
    const parametersDefinitionFiles = this.parameters.flatMap((p) =>
      p.getDefinitionFiles()
    )
    const returnTypeDefinitionFiles = this.returnType.getDefinitionFiles()
    const allFiles = [
      ...returnTypeDefinitionFiles,
      ...parametersDefinitionFiles,
    ]
    return removeDuplicates(allFiles, (a, b) => a.name === b.name)
  }
}

export function createPlatformSpec<
  TPlatform extends Platform,
  TLanguage extends PlatformSpec[TPlatform],
>(
  module: InterfaceDeclaration,
  platform: TPlatform,
  language: TLanguage
): File[] {
  switch (platform) {
    case 'ios':
      switch (language) {
        case 'swift':
          return createAppleSwiftSpec(module)
        case 'c++':
          return createSharedCppSpec(module)
        default:
          throw new Error(`${language} is not supported on ${platform}!`)
      }
    case 'android':
      switch (language) {
        case 'kotlin':
          return createAndroidKotlinSpec(module)
        case 'c++':
          return createSharedCppSpec(module)
        default:
          throw new Error(`${language} is not supported on ${platform}!`)
      }
    default:
      throw new Error(`${platform} is not supported!`)
  }
}

function createSharedCppSpec(module: InterfaceDeclaration): File[] {
  const moduleName = getNodeName(module)
  const cppClassName = `${moduleName}Spec`

  // Properties (getters + setters)
  const properties = module
    .getChildrenOfKind(ts.SyntaxKind.PropertySignature)
    .filter((p) => p.getFirstChildByKind(ts.SyntaxKind.FunctionType) == null)
  const cppProperties = properties.map((p) => new Property(p))

  // Functions
  const functions = module.getChildrenOfKind(ts.SyntaxKind.MethodSignature)
  const cppMethods = functions.map((f) => new Method(f))

  // Extra includes
  const extraDefinitions = [
    ...cppProperties.flatMap((p) => p.getDefinitionFiles()),
    ...cppMethods.flatMap((m) => m.getDefinitionFiles()),
  ]
  const cppExtraIncludesAll = extraDefinitions.map(
    (d) => `#include "${d.name}"`
  )
  const cppExtraIncludes = [...new Set(cppExtraIncludesAll)]

  // Generate the full header / code
  const cppHeaderCode = `
${createFileMetadataString(`${cppClassName}.hpp`)}

#pragma once

#if __has_include(<NitroModules/HybridObject.hpp>)
#include <NitroModules/HybridObject.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed react-native-nitro properly?
#endif

${cppExtraIncludes.join('\n')}

using namespace margelo::nitro;

/**
 * An abstract base class for \`${moduleName}\` (${module.getSourceFile().getBaseName()})
 * Inherit this class to create instances of \`${cppClassName}\` in C++.
 * @example
 * \`\`\`cpp
 * class ${moduleName}: public ${cppClassName} {
 *   // ...
 * };
 * \`\`\`
 */
class ${cppClassName}: public HybridObject {
  public:
    // Constructor
    explicit ${cppClassName}(): HybridObject(TAG) { }

  public:
    // Properties
    ${joinToIndented(cppProperties.map((p) => p.getCode('c++')))}

  public:
    // Methods
    ${joinToIndented(cppMethods.map((m) => m.getCode('c++')))}

  protected:
    // Tag for logging
    static constexpr auto TAG = "${moduleName}";

  private:
    // Hybrid Setup
    void loadHybridMethods() override;
};
    `

  // Each C++ method needs to be registered in the HybridObject - that's getters, setters and normal methods.
  const registrations: string[] = []
  const signatures = [
    ...cppProperties.flatMap((p) => p.cppSignatures),
    ...cppMethods.map((m) => m.cppSignature),
  ]
  for (const signature of signatures) {
    let registerMethod: string
    switch (signature.type) {
      case 'getter':
        registerMethod = 'registerHybridGetter'
        break
      case 'setter':
        registerMethod = 'registerHybridSetter'
        break
      case 'method':
        registerMethod = 'registerHybridMethod'
        break
      default:
        throw new Error(`Invalid C++ Signature Type: ${signature.type}!`)
    }
    registrations.push(
      `${registerMethod}("${signature.rawName}", &${cppClassName}::${signature.name}, this);`
    )
  }

  const cppBodyCode = `
${createFileMetadataString(`${cppClassName}.cpp`)}

#include "${cppClassName}.hpp"

void ${cppClassName}::loadHybridMethods() {
  ${joinToIndented(registrations, '  ')}
}
    `

  const files: File[] = []
  files.push({
    content: cppHeaderCode,
    language: 'c++',
    name: `${cppClassName}.hpp`,
  })
  files.push({
    content: cppBodyCode,
    language: 'c++',
    name: `${cppClassName}.cpp`,
  })
  files.push(...extraDefinitions)
  return files
}

function createAppleSwiftSpec(_module: InterfaceDeclaration): File[] {
  throw new Error(`Swift for Apple/iOS is not yet implemented!`)
}

function createAndroidKotlinSpec(_module: InterfaceDeclaration): File[] {
  throw new Error(`Kotlin for Android is not yet implemented!`)
}
