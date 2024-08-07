///
/// HybridImageFactorySpecCxxResults.swift
/// Wed Aug 07 2024
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/react-native-nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

/**
 * C++ does not support catching Swift errors yet, so we have to wrap
 * them in a Result type.
 * - .value means the function returned successfully (either a value, or void)
 * - .error means the function threw any Error. Only the message can be propagated
 *
 * HybridImageFactorySpecCxx will then wrap all calls to HybridImageFactorySpec
 * to properly catch Swift errors and return either .value or .error to C++.
 */

import NitroModules

/**
 * The exception-free result type for HybridImageFactorySpec.loadImageFromFile(...).
 * Original func:
 * ```swift
 * func loadImageFromFile(path: String) throws -> HybridImageSpec
 * ```
 * - seealso: `HybridImageFactorySpec.loadImageFromFile(path:)`
 */
@frozen
public enum HybridImageFactorySpecCxx_loadImageFromFile_Result {
  case value(HybridImageSpecCxx)
  case error(message: String)
}

/**
 * The exception-free result type for HybridImageFactorySpec.loadImageFromURL(...).
 * Original func:
 * ```swift
 * func loadImageFromURL(path: String) throws -> HybridImageSpec
 * ```
 * - seealso: `HybridImageFactorySpec.loadImageFromURL(path:)`
 */
@frozen
public enum HybridImageFactorySpecCxx_loadImageFromURL_Result {
  case value(HybridImageSpecCxx)
  case error(message: String)
}

/**
 * The exception-free result type for HybridImageFactorySpec.loadImageFromSystemName(...).
 * Original func:
 * ```swift
 * func loadImageFromSystemName(path: String) throws -> HybridImageSpec
 * ```
 * - seealso: `HybridImageFactorySpec.loadImageFromSystemName(path:)`
 */
@frozen
public enum HybridImageFactorySpecCxx_loadImageFromSystemName_Result {
  case value(HybridImageSpecCxx)
  case error(message: String)
}

/**
 * The exception-free result type for HybridImageFactorySpec.bounceBack(...).
 * Original func:
 * ```swift
 * func bounceBack(image: HybridImageSpec) throws -> HybridImageSpec
 * ```
 * - seealso: `HybridImageFactorySpec.bounceBack(image:)`
 */
@frozen
public enum HybridImageFactorySpecCxx_bounceBack_Result {
  case value(HybridImageSpecCxx)
  case error(message: String)
}
