const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
export const amount = (value) => value == null ? '–' : number.format(value)
export const won = (value) => `₩${amount(value)}`
