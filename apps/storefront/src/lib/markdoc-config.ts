/**
 * Markdoc configuration for the journal — custom tags editors can drop into
 * an essay with one line.
 *
 *   {% shloka key="annam" /%}   renders a full ShlokaBlock with Devanagari +
 *                               IAST + English gloss + source citation.
 *   {% ornament /%}             renders the diamond ornamental rule.
 *
 * Tags resolve at build time inside lib/journal.ts (which calls
 * Markdoc.transform with this config). The editor displays the raw tag
 * syntax; rendered output is the styled block.
 */
import Markdoc from '@markdoc/markdoc';
import type { Config, Schema } from '@markdoc/markdoc';
import { shlokas } from '@ghritam/commerce';

type ShlokaKey = keyof typeof shlokas;

const shloka: Schema = {
  render: 'div',
  attributes: {
    key: { type: String, required: true },
  },
  transform(node, cfg) {
    const attrs = node.transformAttributes(cfg) as { key: string };
    const s = (shlokas as Record<string, (typeof shlokas)[ShlokaKey]>)[attrs.key] ?? shlokas.annam;
    const T = Markdoc.Tag;
    return new T('div', { class: 'shloka-block' }, [
      new T('div', { class: 'shloka-block__dev' }, [s.dev]),
      new T('div', { class: 'shloka-block__translit' }, [s.translit]),
      new T('p', { class: 'shloka-block__trans' }, [
        s.trans + ' ',
        new T('span', { class: 'shloka-block__source' }, ['— ' + s.source]),
      ]),
    ]);
  },
};

const ornament: Schema = {
  render: 'div',
  transform() {
    const T = Markdoc.Tag;
    return new T('div', { class: 'ornamental-rule' }, [
      new T('div', { class: 'ornamental-rule__line' }),
      new T('div', { class: 'ornamental-rule__diamond' }),
      new T('div', { class: 'ornamental-rule__line' }),
    ]);
  },
};

export const markdocConfig: Config = {
  tags: { shloka, ornament },
};
