import type { APIRoute } from 'astro';

const SITE = 'https://rnrepo.org';

const SUMMARY =
  'RNRepo speeds up React Native native builds by substituting prebuilt artifacts for building community libraries from source. Built by Software Mansion, for projects on the New Architecture.';

const PAGES = [
  {
    path: '/',
    title: 'RNRepo',
    description: 'How prebuilt artifacts work, setup and FAQ',
  },
  {
    path: '/supported-libraries',
    title: 'Supported libraries',
    description: 'Which React Native libraries are available as prebuilds',
  },
];

export const GET: APIRoute = () =>
  new Response(
    [
      '# RNRepo',
      '',
      `> ${SUMMARY}`,
      '',
      '## Pages',
      '',
      ...PAGES.map(
        (page) => `- [${page.title}](${SITE}${page.path}): ${page.description}`
      ),
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
