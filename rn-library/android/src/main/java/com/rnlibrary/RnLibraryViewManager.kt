package com.rnlibrary

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RnLibraryViewManagerInterface
import com.facebook.react.viewmanagers.RnLibraryViewManagerDelegate

@ReactModule(name = RnLibraryViewManager.NAME)
class RnLibraryViewManager : SimpleViewManager<RnLibraryView>(),
  RnLibraryViewManagerInterface<RnLibraryView> {
  private val mDelegate: ViewManagerDelegate<RnLibraryView>

  init {
    mDelegate = RnLibraryViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<RnLibraryView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): RnLibraryView {
    return RnLibraryView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: RnLibraryView?, color: String?) {
    view?.setBackgroundColor(Color.parseColor(color))
  }

  companion object {
    const val NAME = "RnLibraryView"
  }
}
