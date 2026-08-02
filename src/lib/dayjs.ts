import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import { env } from '@/http/env'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault(env.TIMEZONE)

export { dayjs }
