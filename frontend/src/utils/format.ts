import dayjs from 'dayjs'

export const fmtDate = (iso?: string) => (iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '—')
export const fmtDateShort = (iso?: string) => (iso ? dayjs(iso).format('DD.MM.YYYY') : '—')
