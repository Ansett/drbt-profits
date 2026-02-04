export function useTimezone() {
  // Get all available timezones from Intl and ensure UTC is included
  let timezones: string[] = []
  try {
    timezones = Intl.supportedValuesOf('timeZone')
  } catch (e) {
    // Fallback for browsers that don't support Intl.supportedValuesOf
    console.warn('Intl.supportedValuesOf not supported, using empty timezones array')
  }
  if (!timezones.includes('UTC')) {
    timezones.unshift('UTC')
  }
  const timezoneOptions = timezones.map(tz => ({
    label: tz.replace(/_/g, ' '),
    value: tz,
  }))

  const formatDate = (date?: string | Date, timezone = 'UTC'): [string, string] => {
    if (!date) return ['', '']

    const dateString = typeof date === 'string' ? date : date.toISOString()

    const formatWithTimezone = (tz: string): [string, string] => {
      const date = new Date(dateString)
      const dateOnly = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: tz,
      }).format(date)

      const timeOnly = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz,
      }).format(date)

      return [dateOnly, timeOnly]
    }

    try {
      return formatWithTimezone(timezone)
    } catch (e) {
      // Fallback to UTC if timezone is not supported
      try {
        return formatWithTimezone('UTC')
      } catch (fallbackError) {
        console.error('Error formatting date with UTC fallback:', fallbackError)
        return dateString.split('T') as [string, string]
      }
    }
  }

  return {
    timezoneOptions,
    formatDate
  }
}
