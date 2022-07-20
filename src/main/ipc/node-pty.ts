import { IpcMainEvent } from "electron";

import { IPty, IPtyForkOptions, IWindowsPtyForkOptions, spawn } from "node-pty";

import { IIPCHandler } from "../handlers/ipc";
import { IPCRequests, IPCResponses } from "../../shared/ipc";

export const processes: Record<number, IPty> = { };

export class CreateProcessIPC implements IIPCHandler {
    /**
     * Defines the name of the channel to listen.
     */
    public channel: string = IPCRequests.CreatePtyProcess;

    /**
     * Defines the handler called on the channel receives a message from the renderer process.
     * @param event defines the reference to the IPC event.
     * @param file defines the file to launch.
     * @param args defines the file's arguments as argv (string[]) or in a pre-escaped CommandLine format
     * (string). Note that the CommandLine option is only available on Windows and is expected to be
     * escaped properly.
     * @param options defines the options of the process.
     */
    public handler(event: IpcMainEvent, file: string, args: string | string[], options: IPtyForkOptions | IWindowsPtyForkOptions): void {
        const p = spawn(file, args, options);
        processes[p.pid] = p;

        p.onData((d) => {
            event.sender.send("node-pty-log", {
                data: d,
                pid: p.pid,
            });
        });

        p.onExit((e) => {
            event.sender.send("node-pty-exis", {
                ...e,
                pid: p.pid,
            });
        });

        event.sender.send(IPCResponses.CreatePtyProcess, p.pid);
    }
}

export class WriteProcessIPC implements IIPCHandler {
    /**
     * Defines the name of the channel to listen.
     */
    public channel: string = IPCRequests.WritePtyProcess;

    /**
     * Defines the handler called on the channel receives a message from the renderer process.
     * @param event defines the reference to the IPC event.
     * @param pid defines the id of the terminal process to write in.
     * @param data defines the data (string) to write in the process terminal.
     */
    public handler(event: IpcMainEvent, pid: number, data: string): void {
        const p = processes[pid];
        p?.write(data);

        event.sender.send(IPCResponses.WritePtyProcess, p.pid);
    }
}

export class CloseProcessIPC implements IIPCHandler {
    /**
     * Defines the name of the channel to listen.
     */
    public channel: string = IPCRequests.ClosePtyProcess;

    /**
     * Defines the handler called on the channel receives a message from the renderer process.
     * @param event defines the reference to the IPC event.
     * @param pid defines the id of the terminal process to write in.
     * @param signal defines the signal to use, defaults to SIGHUP. This parameter is not supported on Windows.
     */
    public handler(event: IpcMainEvent, pid: number, signal?: string): void {
        const p = processes[pid];
        if (p) {
            p.kill(signal);
            delete processes[pid];
        }

        event.sender.send(IPCResponses.ClosePtyProcess, p.pid);
    }
}
