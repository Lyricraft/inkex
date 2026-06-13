export type InkexPlaceholderHandler = (arg: object) => string;

export abstract class InkexTemplateHandler {
    protected abstract handle(arg: object): string;
}

export abstract class InkexPlainTemplateHandler extends InkexTemplateHandler {
    private template: string;

    public constructor() {
        super();
        this.template = "";
    }

    // 本方法供给 Inkex 使用
    private setTemplate(template: string) {
        this.template = template;
    }

    public getTemplate() {
        return this.template;
    }
}