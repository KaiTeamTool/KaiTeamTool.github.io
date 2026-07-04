// Central site identity — one place to edit branding/contact.
export const SITE = {
  name: 'KaiTeam',
  // terminal prompt user@host, keeps the "$ user@host:~$" aesthetic
  promptUser: 'kaiteam@tool',
  termPath: 'kaiteamtool ~ /portfolio',
  github: 'https://github.com/KaiTeamTool',
  // TODO: user to supply the real KaiTeamTool contact address before publish
  email: 'kaiteam@proton.me',
  description:
    'KaiTeamTool — small, sharp indie tools: terminal apps, native bits, and the occasional weekend web thing.',
} as const;
