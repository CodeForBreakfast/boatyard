// A pane header that shows a berth's status text beside the pane's name.
// `berth status` keeps the text in the terminal's berth.status hc label. A
// layout names this mod as its pane header in place of Herdr's `pane`:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "berth-pane" } } } }

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, terminals, props, run, theme } from "herdr";

export default class BerthPane extends View {
  init() { this.hovered = false; }

  control(t, pane, icon, command, args) {
    return div().id(`berth-pane-${icon}-${pane}`).p(3).rounded(4).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, { ...args, pane }); })
      // Herdr's own pane header ships these icons.
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  render() {
    const t = theme();
    const p = panes().find((p) => p.pane === props()?.pane);
    if (!p) return div();
    const labels = terminals().find((term) => term.address === p.terminal)?.labels ?? {};
    const name = labels["berth.label"] || p.title || p.program?.name || "shell";
    const status = labels["berth.status"];
    return h_flex().id(`berth-pane-${p.pane}`).size_full().px(10).gap(8).items_center()
      .bg(t.background).border_b(1).border_color(t.border).text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.muted).child(status ?? ""))
      .when(p.status === "working", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.working)))
      .when(p.status === "blocked", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.blocked)))
      .when(p.status === "done", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, (el) => el
        .child(this.control(t, p.pane, "split-right", "pane.split", { direction: "right" }))
        .child(this.control(t, p.pane, "split-down", "pane.split", { direction: "down" }))
        .child(this.control(t, p.pane, p.zoomed ? "unzoom" : "zoom", "pane.zoom", {}))
        .child(this.control(t, p.pane, "close", "pane.close", {})));
  }
}
