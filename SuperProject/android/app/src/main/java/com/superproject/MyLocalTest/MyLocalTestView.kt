package com.superproject.MyLocalTest

import android.content.Context
import android.util.AttributeSet
import android.view.View

class MyLocalTestView : View {
  constructor(context: Context?) : super(context)
  constructor(context: Context?, attrs: AttributeSet?) : super(context, attrs)
  constructor(context: Context?, attrs: AttributeSet?, defStyleAttr: Int) : super(
    context,
    attrs,
    defStyleAttr
  )
}