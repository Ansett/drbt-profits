export function useTimezone() {
  // Get all available timezones from Intl and ensure UTC is included
  const timezones = Intl.supportedValuesOf('timeZone')
  if (!timezones.includes('UTC')) {
    timezones.unshift('UTC')
  }
  const timezoneOptions = timezones.map(tz => ({
    label: tz.replace(/_/g, ' '),
    value: tz,
  }))

  const getTimezoneOffset = (timezone: string) => {
    const date = new Date()
    const tzString = date.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'short' })
    const match = tzString.match(/GMT([+-]\d+)/)
    return match ? match[1] : ''
  }

  const formatDate = (dateString: string, timezone: string): [string, string] => {
    if (!dateString || !timezone) return ['', '']
    
    try {
      const date = new Date(dateString)
      const dateOnly = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone,
      }).format(date)
      
      const timeOnly = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone,
      }).format(date)
      
      return [dateOnly, timeOnly]
    } catch (e) {
      console.error('Error formatting date:', e)
      return ['', '']
    }
  }

  return {
    timezoneOptions,
    getTimezoneOffset,
    formatDate
  }
}
