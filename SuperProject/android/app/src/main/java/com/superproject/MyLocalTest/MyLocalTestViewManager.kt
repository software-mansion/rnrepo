package com.superproject.MyLocalTest


import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.MyLocalTestViewManagerInterface
import com.facebook.react.viewmanagers.MyLocalTestViewManagerDelegate

@ReactModule(name = MyLocalTestViewManager.NAME)
class MyLocalTestViewManager : SimpleViewManager<MyLocalTestView>(),
  MyLocalTestViewManagerInterface<MyLocalTestView> {
  private val mDelegate: ViewManagerDelegate<MyLocalTestView>

  init {
    mDelegate = MyLocalTestViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<MyLocalTestView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): MyLocalTestView {
    return MyLocalTestView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: MyLocalTestView?, color: String?) {
    view?.setBackgroundColor(Color.parseColor(color))
  }

  companion object {
    const val NAME = "MyLocalTestView"
  }
}