import {InkexPlaceholderHandler, InkexPlainTemplateHandler} from "./handlers";

export abstract class OpenTagRecord {
    public readonly name: string;

    protected constructor(name: string) {
        this.name = name;
    }
}

export class RawOpenTagRecord extends OpenTagRecord {
    public constructor(name: string) {
        super(name);
    }
}

export abstract class LocatedOpenTagRecord extends OpenTagRecord {
    public readonly startIndex: number;
    public readonly endIndex: number;

    protected constructor(name: string, startIndex: number, endIndex: number) {
        super(name);
        this.startIndex = startIndex;
        this.endIndex = endIndex;
    }
}

export class PlaceholderOpenTagRecord extends LocatedOpenTagRecord {
    public readonly handler: (arg: object) => string;

    public constructor(name: string, startIndex: number, endIndex: number,
                handler: InkexPlaceholderHandler) {
        super(name, startIndex, endIndex);
        this.handler = handler;
    }
}

export class PlainTemplateOpenTagRecord extends LocatedOpenTagRecord {
    public readonly handler: InkexPlainTemplateHandler;

    public constructor(name: string, startIndex: number, endIndex: number,
                handler: InkexPlainTemplateHandler) {
        super(name, startIndex, endIndex);
        this.handler = handler;
    }
}

