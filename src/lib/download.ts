/** Offers a file to the user as a normal browser download. */
export function saveFile(filename: string, data: string | Blob, mime = 'application/json'): Promise<'saved' | 'cancelled'> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return Promise.resolve('saved')
}
