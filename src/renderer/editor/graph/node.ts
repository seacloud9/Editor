import { Nullable } from "../../../shared/types";

import { Scene } from "babylonjs";
import { LGraphNode, LiteGraph, LLink, SerializedLGraphNode, Vector2, LGraphCanvas } from "litegraph.js";

import { Tools } from "../tools/tools";

import { NodeUtils } from "./utils";

declare module "litegraph.js" {
    export interface LGraphNode {
        widgets?: IWidget[];
    }
}

export enum CodeGenerationOutputType {
    Constant = 0,
    Variable,
    Function,
    CallbackFunction,
    Condition,
    FunctionWithCallback,
}

export enum CodeGenerationExecutionType {
    Start = 0,
    Update,
    Properties,
}

export enum ELinkErrorType {
    /**
     * Defines a link error raised when user wants to connect multiple nodes for an "EVENT".
     */
    MultipleEvent = 0,
}

export interface ICodeGenerationOutput {
    /**
     * Defines the type of the output.
     */
    type: CodeGenerationOutputType;
    /**
     * Defines the generated code as string for the overall node.
     */
    code: string;
    /**
     * Defines the code generated for each output of the node.
     */
    outputsCode?: {
        /**
         * Defines the code generated by the output.
         */
        code?: string
    }[];
    /**
     * Defines where the execution should appear (onStart or onUpdate?).
     */
    executionType?: CodeGenerationExecutionType;
    /**
     * In case of a variable, this contains the name of the variable that is being generated an its value.
     */
    variable?: {
        /**
         * Defines the name of the variable.
         */
        name: string;
        /**
         * Defines the default value of the variable.
         */
        value: string;
    }
    requires?: {
        /**
         * Defines the name of the module to require.
         */
        module: string;
        /**
         * Defines the classes the require from the module.
         */
        classes: string[];
    }[];
}

export interface INodeContextMenuOption {
    /**
     * Defines the label of the extra option in the context menu.
     */
    label: string;
    /**
     * Defines the callback caleld on the menu has been clicked.
     */
    onClick: () => void;
}

export abstract class GraphNode<TProperties = Record<string, any>> extends LGraphNode {
    /**
     * Defines all the available properties of the node.
     */
    public properties: TProperties;
    /**
     * Defines wether or not a break point is set on the node.
     */
    public hasBeakPoint: boolean = false;
    /**
     * Defines wether or not the node is paused on its breakpoint.
     */
    public pausedOnBreakPoint: boolean = false;

    /**
     * Defines the id of the node to be used internally.
     */
    public readonly internalId: string = Tools.RandomId();

    private _resumeFn: Nullable<() => void> = null;
    private _mouseOver: boolean = false;
    private _isExecuting: boolean = false;

    /**
     * Constructor.
     * @param title defines the title of the node.
     */
    public constructor(title?: string) {
        super(title);
    }

    /**
     * Returns the current scene where the graph is running.
     */
    public getScene(): Scene {
        return (this.graph as any).scene;
    }

    /**
     * Called on the graph is being started.
     */
    public onStart(): void {
        // Nothing to do by default.
    }

    /**
     * Called on the graph is being stopped.
     */
    public onStop(): void {
        this.pausedOnBreakPoint = false;
        this._isExecuting = false;

        NodeUtils.ClearCallStack();
        NodeUtils.PausedNode = null;
    }

    /**
     * Configures the node from an object containing the serialized infos.
     * @param infos defines the JSON representation of the node.
     */
    public configure(infos: SerializedLGraphNode): void {
        super.configure(infos);

        this.widgets?.forEach((w) => {
            if (!w.name) { return; }
            if (this.properties[w.name]) {
                w.value = this.properties[w.name];
            }
        });
    }

    /**
     * Retrieves the input data (data traveling through the connection) from one slot
     * @param slot defines the slot id to get its input data.
     * @param force_update defines wether or not to force the connected node of this slot to output data into this link
     */
    public getInputData<T = any>(slot: number, _?: boolean): T {
        return super.getInputData(slot, /* slot > 0 ? true : false */ false);
    }

    /**
     * Triggers an slot event in this node.
     * @param slot the index of the output slot.
     * @param param defines the parameters to send to the target slot.
     * @param link_id in case you want to trigger and specific output link in a slot.
     */
    public async triggerSlot(slot: number, param: any, link_id?: number): Promise<void> {
        if (this.graph!.hasPaused) {
            await this.waitForBreakPoint();
        }
        
        setTimeout(() => {
            super.triggerSlot(slot, param, link_id);
        }, 0);
    }

    /**
     * On connections changed for this node, change its mode according to the new connections.
     * @param type input (1) or output (2).
     * @param slot the slot which has been modified.
     * @param added if the connection is newly added.
     * @param link the link object informations.
     * @param input the input object to check its type etc.
     */
    public onConnectionsChange(type: number, _: number, added: boolean, link: LLink, input: any): void {
        if (this.mode === LiteGraph.NEVER) { return; }

        // Check can't connect multiple triggers
        if (link && added && this.graph && type === LiteGraph.INPUT && input.type === LiteGraph.EVENT) {
            for (const l in this.graph.links) {
                const existingLink = this.graph.links[l];
                const isTrigger = link.type === LiteGraph.EVENT as any;

                if (isTrigger && existingLink.target_id !== link.target_id && existingLink.origin_id === link.origin_id) {
                    this.graph.removeLink(link.id);

                    const canvas = this.graph.list_of_graphcanvas[0];
                    if (canvas && canvas.notifyLinkError) {
                        canvas.notifyLinkError(ELinkErrorType.MultipleEvent);
                    }

                    return;
                }
            }
        }
        
        // Change mode?
        if (link && type === LiteGraph.INPUT && input.type === LiteGraph.EVENT) {
            if (added && input.type === LiteGraph.EVENT) {
                this.mode = LiteGraph.ON_TRIGGER;
            } else {
                this.mode = LiteGraph.ALWAYS;
            }
        }

        NodeUtils.SetColor(this);
    }

    /**
     * Called on the node is being executed.
     */
    public async onExecute(): Promise<void> {
        if (this._isExecuting) {
            return;
        }

        this._isExecuting = true;

        while (this.graph!.hasPaused) {
            await this.waitForBreakPoint();
        }

        NodeUtils.CallStack.push(this);

        if (this.hasBeakPoint) {
            this.graph!.hasPaused = true;
            this.pausedOnBreakPoint = true;
            
            this.focusOn();
            this.getScene()?.render();

            NodeUtils.PausedNode = this;
            await this.waitForBreakPoint();
            NodeUtils.PausedNode = null;
        }

        try {
            this.execute();
        } catch (e) {
            console.error(e);
        }

        while (this.graph!.hasPaused) {
            await this.waitForBreakPoint();
            await Tools.Wait(0);
        }

        NodeUtils.CallStack.pop();
        this._isExecuting = false;
    }

    /**
     * In case of a breakpoint, resumes the graph.
     */
    public resume(): void {
        if (this._resumeFn) {
            this._resumeFn();
        }

        this._resumeFn = null;
    }

    /**
     * Sets the graph canvas to focus on this node.
     */
    public focusOn(): void {
        const graphCanvas = this.graph!.list_of_graphcanvas[0];
        if (!graphCanvas) { return; }

        const start = graphCanvas.ds.offset.slice();
        graphCanvas.centerOnNode(this);

        const end = graphCanvas.ds.offset.slice();
        graphCanvas.ds.offset[0] = start[0];
        graphCanvas.ds.offset[1] = start[1];

        const anim = {
            get x() { return graphCanvas.ds.offset[0]; },
            set x(x: number) { graphCanvas.ds.offset[0] = x; graphCanvas.setDirty(true, true); },

            get y() { return graphCanvas.ds.offset[1]; },
            set y(y: number) { graphCanvas.ds.offset[1] = y; graphCanvas.setDirty(true, true); },
        };

        $(anim).animate({ x: end[0], y: end[1] }, 750, "swing");
    }

    /**
     * Called on the node is being executed.
     */
    public abstract execute(): void;

    /**
     * Generates the code of the node.
     * @param parent defines the parent node that has been generated.
     */
    public abstract generateCode(...inputs: ICodeGenerationOutput[]): ICodeGenerationOutput;

    /**
     * Waits until the graph is resumed.
     */
    public waitForBreakPoint(): Promise<void> {
        if (!this.graph) { return Promise.resolve(); }
        return new Promise<void>((resolve) => this._resumeFn = resolve);
    }

    /**
     * Draws the foreground of the node.
     */
    public onDrawForeground(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
        // Collapsed?
        if (this.flags["collapsed"]) { return; }

        // Mode?
        if (this.mode !== LiteGraph.ON_TRIGGER) { return; }

        ctx = canvas as any as CanvasRenderingContext2D;

        if (this.hasBeakPoint) {
            if (this.pausedOnBreakPoint) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.size[0] - 20, -25);
                ctx.lineTo(this.size[0] - 20, -5);
                ctx.lineTo(this.size[0] - 5, -15);
                ctx.fillStyle = "#FF0000";
                ctx.fill();
                ctx.closePath();
                ctx.restore();
            } else {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(this.size[0] - 20, -15, 10, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.pausedOnBreakPoint ? 255 : 100}, 0, 0, 255)`;
                ctx.fill();
                ctx.closePath();
                ctx.restore();
            }
        } else if (this._mouseOver) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = "#ff0000";
            ctx.arc(this.size[0] - 20, -15, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.closePath();
            ctx.restore();
        }
    }

    /**
     * Called on the mouse is down on the node.
     * @param event defines the reference to the mouse original event.
     * @param pos defines the position.
     * @param graphCanvas defines the canvas where the node is drawn.
     */
    public onMouseDown(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
        if (super.onMouseDown) {
            super.onMouseDown(event, pos, graphCanvas);
        }

        // Collapsed?
        if (this.flags["collapsed"]) { return; }

        // Mode?
        if (this.mode !== LiteGraph.ON_TRIGGER) { return; }

        if (pos[0] >= this.size[0] - 30 && pos[1] <= 5) {
            if (this.graph) {
                this.graph.list_of_graphcanvas[0].canvas.style.cursor = "";
            }

            if (this.pausedOnBreakPoint) {
                NodeUtils.ResumeExecution();
            } else {
                this.hasBeakPoint = !this.hasBeakPoint;
            }
        }
    }

    /**
     * Called on the mouse enters the node.
     * @param event defines the reference to the mouse original event.
     * @param pos defines the position.
     * @param graphCanvas defines the canvas where the node is drawn.
     */
    public onMouseMove(_: MouseEvent, pos: Vector2, __: LGraphCanvas): void {
        // Collapsed?
        if (this.flags["collapsed"]) { return; }

        // Mode?
        if (this.mode !== LiteGraph.ON_TRIGGER) { return; }
        
        if (pos[0] >= this.size[0] - 30 && pos[1] <= 5) {
            setTimeout(() => this.graph!.list_of_graphcanvas[0].canvas.style.cursor = "pointer", 0);
        }
    }

    /**
     * Called on the mouse enters the node.
     * @param event defines the reference to the mouse original event.
     * @param pos defines the position.
     * @param graphCanvas defines the canvas where the node is drawn.
     */
    public onMouseEnter(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
        if (super.onMouseEnter) {
            super.onMouseEnter(event, pos, graphCanvas);
        }

        this._mouseOver = true;
    }

    /**
     * Called on the mouse leaves the node.
     * @param event defines the reference to the mouse original event.
     * @param pos defines the position.
     * @param graphCanvas defines the canvas where the node is drawn.
     */
    public onMouseLeave(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
        if (super.onMouseLeave) {
            super.onMouseLeave(event, pos, graphCanvas);
        }

        this._mouseOver = false;
    }

    /**
     * Called on the node is right-clicked in the Graph Editor.
     * This is used to show extra options in the context menu.
     */
    public getContextMenuOptions?(): INodeContextMenuOption[];
}
