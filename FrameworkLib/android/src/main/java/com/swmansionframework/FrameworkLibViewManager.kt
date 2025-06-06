package com.swmansionframework

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.FrameworkLibViewManagerInterface
import com.facebook.react.viewmanagers.FrameworkLibViewManagerDelegate

@ReactModule(name = FrameworkLibViewManager.NAME)
class FrameworkLibViewManager : SimpleViewManager<FrameworkLibView>(),
  FrameworkLibViewManagerInterface<FrameworkLibView> {
  private val mDelegate: ViewManagerDelegate<FrameworkLibView>

  init {
    mDelegate = FrameworkLibViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<FrameworkLibView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): FrameworkLibView {
    return FrameworkLibView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: FrameworkLibView?, color: String?) {
    view?.setBackgroundColor(Color.parseColor(color))
  }

  companion object {
    const val NAME = "FrameworkLibView"
  }
}
