' SmartPOS Server - Скрытый запуск
' Этот скрипт запускает сервер в фоновом режиме

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\server"

' Запуск сервера в скрытом окне (0 = Hidden)
WshShell.Run "cmd /c node src/index.js", 0, False

WScript.Echo "SmartPOS Server запущен в фоновом режиме!" & vbCrLf & vbCrLf & "Сервер доступен по адресу: http://localhost:5000"
