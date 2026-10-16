// cj <pid> tabs | js <w> <t> <file|-> | go <w> <t> <url> | show <w>
import Foundation
import ScriptingBridge
import AppKit
let a = CommandLine.arguments
guard a.count >= 3, let pid = pid_t(a[1]), let app = SBApplication(processIdentifier: pid) else { print("usage"); exit(2) }
let windows = app.value(forKey: "windows") as! SBElementArray
func tab(_ w: Int, _ t: Int) -> SBObject {
  let win = windows.object(at: w) as! SBObject
  let tabs = win.value(forKey: "tabs") as! SBElementArray
  return tabs.object(at: t) as! SBObject
}
switch a[2] {
case "tabs":
  for i in 0..<windows.count {
    let win = windows.object(at: i) as! SBObject
    let tabs = win.value(forKey: "tabs") as! SBElementArray
    for j in 0..<tabs.count { let t = tabs.object(at: j) as! SBObject
      print("\(i) \(j) \(t.value(forKey: "URL") ?? "") | \(t.value(forKey: "title") ?? "")") }
  }
case "js":
  let w = Int(a[3])!, t = Int(a[4])!
  let code = a[5] == "-" ? String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8)! : (try! String(contentsOfFile: a[5], encoding: .utf8))
  let r = tab(w, t).perform(Selector(("executeJavascript:")), with: code)
  if let v = r?.takeUnretainedValue() { print(v) } else { print("(nil)") }

case "go":
  let w = Int(a[3])!, t = Int(a[4])!
  tab(w, t).setValue(a[5], forKey: "URL")
  print("navigated")
case "show":
  let w = Int(a[3])!
  let win = windows.object(at: w) as! SBObject
  win.setValue(false, forKey: "minimized")
  win.setValue(1, forKey: "index")
  NSRunningApplication(processIdentifier: pid)?.activate()
  print("shown minimized=\(win.value(forKey: "minimized") ?? "?")")
default: print("unknown")
}
