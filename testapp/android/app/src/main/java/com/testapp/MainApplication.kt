package com.testapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Packages that cannot be autolinked yet can be added manually here, for example:
                    // add(MyReactNativePackage())
                    
                    // AAR automation - auto-generated package registration
                    if (BuildConfig.USE_PREBUILT_AARS) {
                      try {
            val reactnativesvgClass = Class.forName("com.horcrux.svg.SvgPackage")
            add(reactnativesvgClass.newInstance() as ReactPackage)
            val reactnativescreensClass = Class.forName("com.swmansion.rnscreens.RNScreensPackage")
            add(reactnativescreensClass.newInstance() as ReactPackage)
            val reactnativegesturehandlerClass = Class.forName("com.swmansion.gesturehandler.RNGestureHandlerPackage")
            add(reactnativegesturehandlerClass.newInstance() as ReactPackage)
            val reactnativesafeareacontextClass = Class.forName("com.th3rdwave.safeareacontext.SafeAreaContextPackage")
            add(reactnativesafeareacontextClass.newInstance() as ReactPackage)
                      } catch (e: Exception) {
                        android.util.Log.e("MainApplication", "Failed to load pre-built AAR packages: ${e.message}")
                      }
                    }
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        loadReactNative(this)
    }
}
