//Original work Copyright (c) 2018, Duarte Henriques, https://github.com/portablemind/grapesjs-code-editor
//Modified work Copyright (c) 2020, Brendon Ngirazi,
//All rights reserved.

import Split from 'split.js';

export class CodeEditor {
    constructor(editor, opts) {
        console.log(opts, editor)
        this.editor = editor;
        this.$ = editor.$;
        this.pfx = editor.getConfig('stylePrefix');
        this.opts = opts;
        this.canvas = this.findWithinEditor(`.${this.pfx}cv-canvas`);
        this.panelViews = opts.appendTo || 'panel'
        this.isShowing = true;

    }

    findPanel() {
        const pn = this.editor.Panels;
        const id = this.opts.panelId;
        return pn.getPanel(id) || pn.addPanel({ id });
    }

    findWithinEditor(selector) {
        return this.$(selector, this.editor.getEl());
    }

    /**
     * 
     * @param {*} type 
     * @returns 
     * 
     * Adds monaco editor to the code view
     */
    buildCodeEditor() {

        let e = document.querySelector('wc-monaco-editor').editor
        e.updateOptions({
            "language": "html",
            "theme": "vs-dark",
            "automaticLayout": true,
            "lineNumbersMinChars": 3,
            "mouseWheelZoom": true,
            //"minimap": "",
            //"wordWrap": "",
            "wrappingIndent": "",
            "autoIndent": true,
            "formatOnPaste": true,
            "formatOnType": true
        })
        return e;
    }

    buildSection(type, codeViewer) {
        const { $, pfx, opts } = this;
        const section = $('<section></section>');
        const btnText = type === 'html' ? opts.htmlBtnText : opts.cssBtnText;
        const cleanCssBtn = (opts.cleanCssBtn && type === 'css') ?
            `<button class="cp-delete-${type} ${pfx}btn-prim">${opts.cleanCssBtnText}</button>` : '';
        section.append($(`
            <div class="codepanel-separator">
                <div class="codepanel-label">${type}</div>
                <div class="cp-btn-container mt-2">
                    <button class="cp-apply-html btn-light btn-xs mr-2">${btnText}</button>
                </div>
            </div>`));
        const codeViewerEl = codeViewer._domElement
        codeViewerEl.style.height = 'calc(50vh - 30px)';
        codeViewerEl.style.transition = 'height 1s';
        codeViewerEl.style.minHeight = '40vh';
        codeViewerEl.style.maxHeight = '50vh';

        section.append(codeViewerEl);
        this.codePanel.append(section);
        return section.get(0);
    }

    buildCodePanel() {
        const { $, editor } = this;
        this.codePanel = $('<div></div>');
        this.codePanel.addClass('code-panel');

        this.htmlCodeEditor = this.buildCodeEditor('html');
        //this.cssCodeEditor = this.buildCodeEditor('css');

        const sections = [this.buildSection('html', this.htmlCodeEditor)];
        console.log($(this.opts.appendTo), $)
        $(this.opts.appendTo).append(this.codePanel);
        this.updateEditorContents();

        this.codePanel.find('.cp-apply-html').on('click', this.updateHtml.bind(this));

        Split(sections, {
            direction: 'vertical',
            sizes: [100],
            minSize: 100,
            gutterSize: 1,
            onDragEnd: this.refreshEditors.bind(this),
        });

        editor.on('component:update', model => this.updateEditorContents());
        editor.on('stop:preview', () => {
            if (this.isShowing && !this.opts.preserveWidth) {
                this.canvas.css('width', this.opts.openState.cv);
            }
        });
    }

    showCodePanel() {
        this.isShowing = true;
        this.updateEditorContents();
        document.getElementById('codeEditor').style.height = '50vh'
        document.getElementById('gjs').style.height = '50vh'
        //this.codePanel.css('display', 'block');
        // make sure editor is aware of width change after the 300ms effect ends
        setTimeout(this.refreshEditors.bind(this), 320);

        if (this.opts.preserveWidth) return;

        //this.panelViews.css('width', this.opts.openState.pn);
        //this.canvas.css('width', this.opts.openState.cv);
    }

    hideCodePanel() {
        console.log("closing")
        if (this.isShowing) {
            console.log("close edits")
        }
        document.getElementById('codeEditor').style.height = '0px'
        document.getElementById('gjs').style.height = '100%'
        this.isShowing = false;
    }

    refreshEditors() {
        this.htmlCodeEditor.refresh();
        //this.cssCodeEditor.refresh();
    }

    updateHtml(e) {
        e?.preventDefault();
        console.log(e, 'apply')
        const { editor, component } = this;
        let htmlCode = this.htmlCodeEditor.getModel().getValue();
        console.log(htmlCode)
        if (!htmlCode || htmlCode === this.previousHtmlCode) return;
        this.previousHtmlCode = htmlCode;
        if (component && component.attributes.type === 'wrapper') {
            editor.setComponents(htmlCode);
        } else {
            editor.select(component.replaceWith(htmlCode));
        }
        return htmlCode;
    }

    updateCss(e) {
        e?.preventDefault();
        const cssCode = this.cssCodeEditor.getContent().trim();
        if (!cssCode || cssCode === this.previousCssCode) return;
        this.previousCssCode = cssCode;
        this.editor.Css.addRules(cssCode);
        return cssCode;
    }

    deleteSelectedCss(e) {
        e?.preventDefault();
        const selections = this.cssCodeEditor.editor.getSelections();
        selections.forEach(selection => this.parseRemove(selection));
        this.cssCodeEditor.editor.deleteH();
    }

    parseRemove(removeCss) {
        return this.editor.Css.remove(this.getRules(editor.Parser.parseCss(removeCss)));
    }

    getRules(rules, opts = {}) {
        const { editor } = this;
        const sm = editor.Selectors;
        return rules.map((rule) => {
            const selector = sm.get(rule.selectors);
            const { state, selectorsAdd } = rule;
            const { atRuleType, atRuleParams } = opts;
            return (
                selector &&
                editor.Css.get(selector, state, atRuleParams, {
                    selectorsAdd,
                    atRule: atRuleType,
                })
            );
        });
    }

    updateEditorContents() {
        if (!this.isShowing) return;

        this.component = this.editor.getSelected();
        if (this.component) {
            // set value to editor
            this.htmlCodeEditor.getModel().setValue(this.getComponentHtml(this.component));
            this.htmlCodeEditor.getAction('editor.action.formatDocument').run()
        }
    }

    getComponentHtml(component) {
        const { pfx, opts } = this;
        let result = '';
        const componentEl = component.getEl();

        !opts.clearData && componentEl.classList.remove(`${pfx}selected`);
        const html = opts.clearData ? component.toHTML() :
            (component.attributes.type === 'wrapper' ? componentEl.innerHTML : componentEl.outerHTML);
        !opts.clearData && componentEl.classList.add(`${pfx}selected`);
        result += html;

        const js = opts.editJs ? component.getScriptString() : '';
        result += js ? `<script>${js}</script>` : '';

        return result;
    }
}
