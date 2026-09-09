export const paths = {
  home: '/',
  login: '/login',
  records: '/records',
  newRecord: '/records/new',
  record: (id: string) => `/records/${id}`,
  recordPrint: (id: string) => `/print/records/${id}`,
  directory: '/directory',
} as const
