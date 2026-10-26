/**
 * Texts of the site (German only, like pe-admin.de) live in site.json; firm data below.
 * fill() replaces {n} style placeholders.
 */
import site from './site.json';

export const T = site;

export const FIRM = {
  name: 'PE Admin GmbH',
  street: 'Römerstr. 111',
  zip: '82205',
  city: 'Gilching',
  phone: '+49 172 1697253',
  phoneHref: 'tel:+491721697253',
  mail: 'info@pe-admin.de',
  ceo: 'Franz Swidriw',
};

export function fill(text: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);
}
