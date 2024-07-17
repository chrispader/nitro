//
//  SwiftTestHybridObject.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 23.06.24.
//

#pragma once

#include "HybridObject.hpp"
#include "HybridContext.hpp"

#if __has_include("NitroModules-Swift.h")
#include "NitroModules-Swift.h"
#include "DoesClassExist.hpp"

namespace margelo::nitro {

static_assert(does_class_exist_v<NitroModules::SwiftTestHybridObject>,
              "Swift class \"SwiftTestHybridObject\" does not exist! Does the class exist in Swift, and is it marked as public?");


// Generated by Nitrogen (C++ HybridObject bindings)
class SwiftTestHybridObject: public HybridObject {
private:
  explicit SwiftTestHybridObject(NitroModules::SwiftTestHybridObject swiftPart);

public:
  static std::shared_ptr<SwiftTestHybridObject> getHybridPart(NitroModules::SwiftTestHybridObject swiftPart);

public:

  int getInt();
  void setInt(int value);

  int throwError();

  void loadHybridMethods() override;

private:
  NitroModules::SwiftTestHybridObject _swiftPart;
};

}

#endif
