///
/// JHybridImageSpec.cpp
/// Wed Aug 07 2024
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/react-native-nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

#include "JHybridImageSpec.hpp"



#include "JImageSize.hpp"
#include "JPixelFormat.hpp"
#include "JImageFormat.hpp"
#include "JFunc_void_std__string.hpp"

namespace margelo::nitro::image {

  jni::local_ref<JHybridImageSpec::jhybriddata> JHybridImageSpec::initHybrid(jni::alias_ref<jhybridobject> jThis) {
    return makeCxxInstance(jThis);
  }

  void JHybridImageSpec::registerNatives() {
    registerHybrid({
      makeNativeMethod("initHybrid", JHybridImageSpec::initHybrid),
    });
  }

  size_t JHybridImageSpec::getExternalMemorySize() noexcept {
    static const auto method = _javaPart->getClass()->getMethod<jlong()>("getMemorySize");
    return method(_javaPart.get());
  }

  // Properties
  ImageSize JHybridImageSpec::getSize() {
    static const auto method = _javaPart->getClass()->getMethod<JImageSize()>("getSize");
    throw std::runtime_error("getSize(...) is not yet implemented!");
  }
  PixelFormat JHybridImageSpec::getPixelFormat() {
    static const auto method = _javaPart->getClass()->getMethod<JPixelFormat()>("getPixelFormat");
    throw std::runtime_error("getPixelFormat(...) is not yet implemented!");
  }
  double JHybridImageSpec::getSomeSettableProp() {
    static const auto method = _javaPart->getClass()->getMethod<double()>("getSomeSettableProp");
    throw std::runtime_error("getSomeSettableProp(...) is not yet implemented!");
  }
  void JHybridImageSpec::setSomeSettableProp(double someSettableProp) {
    static const auto method = _javaPart->getClass()->getMethod<void(double)>("setSomeSettableProp");
    throw std::runtime_error("setSomeSettableProp(...) is not yet implemented!");
  }

  // Methods
  double JHybridImageSpec::toArrayBuffer(ImageFormat format) {
    static const auto method = _javaPart->getClass()->getMethod<double(JImageFormat)>("toArrayBuffer");
    throw std::runtime_error("toArrayBuffer(...) is not yet implemented!");
  }
  void JHybridImageSpec::saveToFile(const std::string& path, const Func_void_std__string& onFinished) {
    static const auto method = _javaPart->getClass()->getMethod<void(std::string, jni::alias_ref<JFunc_void_std__string::javaobject>)>("saveToFile");
    throw std::runtime_error("saveToFile(...) is not yet implemented!");
  }

} // namespace margelo::nitro::image
