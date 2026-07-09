/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import sanitizeHtml from "sanitize-html";
import classnames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { AutoHideScrollbar } from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import dis from "../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { type ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions.ts";
import { sanitizedHtmlNode } from "../../HtmlUtils.tsx";
import { sanitizeHtmlParams, transformTags } from "../../Linkify.ts";
import { objectExcluding } from "../../utils/objects.ts";

// Balises SVG de présentation autorisées pour les pages embarquées (contenu de confiance,
// fourni par l'exploitant via embedded_pages.home_url). On exclut les vecteurs XSS
// (script, foreignObject, animate, a, use/image avec href externe).
const EMBEDDED_SVG_TAGS = [
    "svg",
    "g",
    "defs",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "title",
    "desc",
    "text",
    "tspan",
];

// Attributs SVG de présentation (appliqués via la clé "*"). Aucun attribut d'URL/href.
const EMBEDDED_SVG_ATTRS = [
    "xmlns",
    "viewBox",
    "preserveAspectRatio",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "fill-rule",
    "fill-opacity",
    "clip-rule",
    "clip-path",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-opacity",
    "opacity",
    "transform",
    "gradientUnits",
    "gradientTransform",
    "offset",
    "stop-color",
    "stop-opacity",
    "class",
    "id",
    "style",
];

interface IProps {
    // URL to request embedded page content from
    url?: string;
    // Class name prefix to apply for a given instance
    className?: string;
    // Whether to wrap the page in a scrollbar
    scrollbar?: boolean;
    // Map of keys to replace with values, e.g {$placeholder: "value"}
    replaceMap?: Record<string, string>;
}

interface IState {
    page: string;
}

export default class EmbeddedPage extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;
    private unmounted = false;
    private dispatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            page: "",
        };
    }

    private translate(s: TranslationKey): string {
        return sanitizeHtml(_t(s));
    }

    private async fetchEmbed(): Promise<void> {
        let res: Response;

        try {
            res = await fetch(this.props.url!, { method: "GET" });
        } catch (err) {
            if (this.unmounted) return;
            logger.warn(`Error loading page: ${err}`);
            this.setState({ page: _t("cant_load_page") });
            return;
        }

        if (this.unmounted) return;

        if (!res.ok) {
            logger.warn(`Error loading page: ${res.status}`);
            this.setState({ page: _t("cant_load_page") });
            return;
        }

        // Replace '," and HTML encoded variants
        let body = (await res.text()).replace(
            /_t\((?:['"]|(?:&#(?:34|27);))([\s\S]*?)(?:['"]|(?:&#(?:34|27);))\)/gm,
            (match, g1) => this.translate(g1),
        );

        if (this.props.replaceMap) {
            Object.keys(this.props.replaceMap).forEach((key) => {
                body = body.split(key).join(this.props.replaceMap![key]);
            });
        }

        this.setState({ page: body });
    }

    public componentDidMount(): void {
        this.unmounted = false;

        if (!this.props.url) {
            return;
        }

        // We use fetch to inline the page into the react component
        // so that it can inherit CSS and theming easily rather than mess around
        // with iframes and trying to synchronise document.stylesheets.
        this.fetchEmbed();

        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload): void => {
        // HACK: Workaround for the context's MatrixClient not being set up at render time.
        if (payload.action === Action.ClientStarted) {
            this.forceUpdate();
        }
    };

    public render(): React.ReactNode {
        // HACK: Workaround for the context's MatrixClient not updating.
        const client = this.context || MatrixClientPeg.get();
        const isGuest = client ? client.isGuest() : true;
        const className = this.props.className;
        const classes = classnames(className, {
            mx_AutoHideScrollbar: this.props.scrollbar,
            [`${className}_guest`]: isGuest,
            [`${className}_loggedIn`]: !!client,
        });

        const content = sanitizedHtmlNode(this.state.page, `${className}_body`, {
            ...sanitizeHtmlParams,
            // On autorise aussi la balise <style> : la page embarquée (de confiance) porte
            // toute sa mise en forme — layout, couleurs des icônes SVG, classes — dans un bloc CSS.
            allowedTags: [...sanitizeHtmlParams.allowedTags!, ...EMBEDDED_SVG_TAGS, "style"],
            // <style> est marqué "vulnérable" par sanitize-html (XSS via CSS). Contenu de confiance
            // ici (fourni par l'exploitant, même niveau que config.json), donc explicitement accepté.
            allowVulnerableTags: true,
            allowedAttributes: {
                ...sanitizeHtmlParams.allowedAttributes,
                "*": [...(sanitizeHtmlParams.allowedAttributes?.["*"] ?? []), ...EMBEDDED_SVG_ATTRS],
            },
            // Préserver la casse : sinon sanitize-html renomme viewBox -> viewbox et casse le rendu SVG.
            parser: { ...sanitizeHtmlParams.parser, lowerCaseTags: false, lowerCaseAttributeNames: false },
            transformTags: objectExcluding(transformTags, [
                // Disable the transformer for `img` as it only allows mxc resources
                "img",
                // Disable the default transformer as it forbids inline styles
                "*",
            ]),
        });

        if (this.props.scrollbar) {
            return <AutoHideScrollbar className={classes}>{content}</AutoHideScrollbar>;
        } else {
            return <div className={classes}>{content}</div>;
        }
    }
}
