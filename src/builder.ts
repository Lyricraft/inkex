import {InkexPlaceholderHandler, InkexTemplateHandler} from "./handlers";
import {Inkex, InkexHandleRegister} from "./inkex";

export class InkexBuilder {
    private readonly templateRaw: string;
    private readonly handlers: InkexHandleRegister;

    public constructor(template: string) {
        this.templateRaw = template;
        this.handlers = new InkexHandleRegister();
    }

    public placeholder(tag: string, handler: InkexPlaceholderHandler) {
        this.handlers.placeholder(tag, handler);
        return this;
    }

    public template(tag: string, inner: InkexTemplateHandler) {
        this.handlers.template(tag, inner);
        return this;
    }

    public build() {
        return Inkex.create(this.templateRaw, this.handlers);
    }
}

export function inkex(template: string) {
    return new InkexBuilder(template);
}