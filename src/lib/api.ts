export const TOKEN_KEY = 'raymond_log_jwt_token'
export const USER_KEY = 'raymond_log_username'

// 生成当前设备的唯一工牌 ID（刷新页面或不同浏览器独立互不相同）
export const CLIENT_ID = `client_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const getUsername = (): string | null => localStorage.getItem(USER_KEY)

export const setAuthStorage = (token: string, username: string) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, username)
}

export const clearAuthStorage = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(endpoint, { ...options, headers })
  } catch (err: any) {
    throw new Error('无法连接到服务器，请确保 3300 后端服务已启动')
  }

  if (res.status === 401 || res.status === 403) {
    clearAuthStorage()
    window.location.reload()
    throw new Error('登录状态失效，请重新登录')
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    if (!res.ok) {
      throw new Error(`服务器响应异常 (${res.status})，后端 3300 端口可能未开启`)
    }
    throw new Error('服务器未返回有效数据')
  }

  if (!res.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data
}

// 统一保存业务数据接口（自动携带当前设备工牌 CLIENT_ID）
export async function saveUserData(namespace: string, data: any): Promise<void> {
  await apiRequest(`/api/data/${namespace}`, {
    method: 'POST',
    body: JSON.stringify({
      data,
      clientId: CLIENT_ID,
    }),
  })
}

// 图片文件上传接口（返回短相对路径，如 /uploads/img_xxx.webp）
export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const res = await apiRequest<{ url: string }>('/api/upload', {
    method: 'POST',
    body: formData,
  })
  return res.url
}