/// <reference types="vite/client" />

declare module 'plotly.js-dist-min' {
  import Plotly from 'plotly.js'
  export = Plotly
  export as namespace Plotly
}

declare module 'react-plotly.js' {
  import { Component } from 'react'
  interface PlotParams {
    data: Plotly.Data[]
    layout?: Partial<Plotly.Layout>
    config?: Partial<Plotly.Config>
    style?: React.CSSProperties
    className?: string
    useResizeHandler?: boolean
    onInitialized?: (figure: Readonly<{ data: Plotly.Data[]; layout: Partial<Plotly.Layout> }>, graphDiv: HTMLElement) => void
    onUpdate?: (figure: Readonly<{ data: Plotly.Data[]; layout: Partial<Plotly.Layout> }>, graphDiv: HTMLElement) => void
  }
  export default class Plot extends Component<PlotParams> {}
}
