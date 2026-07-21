import axios from 'axios'
import { env } from '@/http/env'

export const API_PROTHEUS_DATA = axios.create({
  baseURL: env.API_PROTHEUS_DATA_URL,
})
