export enum IPCRequests {
	OpenWindowOnDemand = "openwindowondemand",

	OpenFileDialog = "openfiledialog",
	SaveFileDialog = "savefiledialog",
	OpenDirectoryDialog = "opendirectorydialog",

	GetProjectPath = "getprojectpath",
	SetProjectPath = "setprojectpath",

	GetWorkspacePath = "getworkspacepath",
	SetWorkspacePath = "setworkspacepath",

	GetAppPath = "getapppath",
	GetWindowId = "getwindowid",

	TrashItem = "trashitem",

	StartGameServer = "startgameserver",

	FocusWindow = "focuswindow",
	CloseWindow = "closewindow",
	SendWindowMessage = "sendwindowmessage",

	OpenDevTools = "opendevtools",
	EnableDevTools = "enabledevtools",

	SetTouchBar = "settouchbar",

	CreatePtyProcess = "createptyprocess",
	WritePtyProcess = "writeptyprocess",
	ClosePtyProcess = "closeptyprocess",
}

export enum IPCResponses {
	OpenWindowOnDemand = "openwindowondemand",

	OpenFileDialog = "openfiledialog",
	SaveFileDialog = "savefiledialog",
	OpenDirectoryDialog = "opendirectorydialog",
	CancelOpenFileDialog = "cancelopenfiledialog",
	CancelSaveFileDialog = "cancelsavefiledialog",

	GetProjectPath = "getprojectpath",
	SetProjectPath = "setprojectpath",

	GetWorkspacePath = "getworkspacepath",
	SetWorkspacePath = "setworkspacepath",

	GetAppPath = "getapppath",
	GetWindowId = "getwindowid",

	TrashItem = "trashitem",

	StartGameServer = "startgameserver",

	SendWindowMessage = "sendwindowmessage",

	EnableDevTools = "enabledevtools",

	CreatePtyProcess = "createptyprocess",
	WritePtyProcess = "writeptyprocess",
	ClosePtyProcess = "closeptyprocess",
}
