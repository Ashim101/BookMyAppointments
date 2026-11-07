import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'
import { clearSession, readSession, writeSession } from '../../api/session'

export const STAFF_ROLES = ['admin', 'doctor']

const fromTokens = (tokens) =>
  tokens
    ? { user: tokens.user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
    : { user: null, accessToken: null, refreshToken: null }

export const loadInitialState = () => {
  const stored = readSession()
  return fromTokens(stored && STAFF_ROLES.includes(stored.user.role) ? stored : null)
}

export const signIn = createAsyncThunk('auth/signIn', async (credentials, { rejectWithValue }) => {
  try {
    const tokens = await authApi.login(credentials)
    if (!STAFF_ROLES.includes(tokens.user.role)) {
      throw new ApiError({ code: 'FORBIDDEN', message: 'This app is for administrators and doctors only.' })
    }
    writeSession(tokens)
    return tokens
  } catch (error) {
    return rejectWithValue({ code: error.code, message: error.message, details: error.details })
  }
})

export const signOut = createAsyncThunk('auth/signOut', async () => {
  try {
    await authApi.logout()
  } catch {
    // the local session is cleared by logout() even when the server call fails
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState,
  reducers: {
    tokensRefreshed: (state, { payload }) => Object.assign(state, fromTokens(payload)),
    sessionCleared: () => {
      clearSession()
      return fromTokens(null)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.fulfilled, (state, { payload }) => Object.assign(state, fromTokens(payload)))
      .addCase(signOut.fulfilled, () => fromTokens(null))
  },
})

export const { tokensRefreshed, sessionCleared } = authSlice.actions
export const selectUser = (state) => state.auth.user
export const selectRole = (state) => state.auth.user?.role ?? null
export const homePath = (role) => (role === 'admin' ? '/admin' : '/doctor')

export default authSlice.reducer
