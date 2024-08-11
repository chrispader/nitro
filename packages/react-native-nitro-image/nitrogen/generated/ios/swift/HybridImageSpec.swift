///
/// HybridImageSpec.swift
/// Sun Aug 11 2024
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/react-native-nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

import Foundation
import NitroModules

/**
 * A Swift protocol representing the Image HybridObject.
 * Implement this protocol to create Swift-based instances of Image.
 *
 * When implementing this protocol, make sure to initialize `hybridContext` - example:
 * ```
 * public class HybridImage : HybridImageSpec {
 *   // Initialize HybridContext
 *   var hybridContext = margelo.nitro.HybridContext()
 *
 *   // Return size of the instance to inform JS GC about memory pressure
 *   var memorySize: Int {
 *     return getSizeOf(self)
 *   }
 *
 *   // ...
 * }
 * ```
 */
public protocol HybridImageSpec: HybridObjectSpec {
  // Properties
  var size: margelo.nitro.image.ImageSize { get }
  var pixelFormat: margelo.nitro.image.PixelFormat { get }
  var someSettableProp: Double { get set }

  // Methods
  func toArrayBuffer(format: margelo.nitro.image.ImageFormat) throws -> Double
  func saveToFile(path: String, onFinished: margelo.nitro.image.Func_void_std__string) throws -> Void
}

public extension HybridImageSpec {
  /**
   * Create a new instance of HybridImageSpecCxx for the given HybridImageSpec.
   *
   * Instances of HybridImageSpecCxx can be accessed from C++, and contain
   * additional required bridging code for C++ <> Swift interop.
   */
  func createCxxBridge() -> HybridImageSpecCxx {
    return HybridImageSpecCxx(self)
  }
}
