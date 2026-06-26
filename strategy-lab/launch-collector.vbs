' Run the Node collector without creating a console window.
Option Explicit

Dim shell, nodePath, collectorPath, projectRoot, command
If WScript.Arguments.Count < 3 Then WScript.Quit 2

nodePath = WScript.Arguments.Item(0)
collectorPath = WScript.Arguments.Item(1)
projectRoot = WScript.Arguments.Item(2)
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & collectorPath & Chr(34)

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = projectRoot
shell.Run command, 0, True
