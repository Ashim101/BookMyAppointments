import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as authApi from '../../api/auth'
import { loadTokens } from '../../lib/tokenStorage'

const slice = createSlice({
  name: 'auth',
  initialState: () => ({ tokens: loadTokens() }),
  reducers: {
    setSession(state, { payload }) {
      state.tokens = payload
    },
    updateUser(state, { payload }) {
      if (state.tokens) state.tokens.user = { ...state.tokens.user, ...payload }
    },
    clearSession(state) {
      state.tokens = null
    },
  },
})

export const { setSession, updateUser, clearSession } = slice.actions
export default slice.reducer

export const selectTokens = (state) => state.auth.tokens
export const selectUser = (state) => state.auth.tokens?.user ?? null
export const selectIsAuthenticated = (state) => Boolean(state.auth.tokens?.accessToken)

const sessionThunk = (name, call) =>
  createAsyncThunk(`auth/${name}`, async (arg, { dispatch }) => {
    const tokens = await call(arg)
    dispatch(setSession(tokens))
    return tokens.user
  })

export const signIn = sessionThunk('signIn', authApi.login)
export const signUp = sessionThunk('signUp', authApi.register)
export const signInWithGoogle = sessionThunk('signInWithGoogle', authApi.googleLogin)

export const signOut = createAsyncThunk('auth/signOut', async (_, { dispatch, getState }) => {
  const refreshToken = selectTokens(getState())?.refreshToken
  try {
    if (refreshToken) await authApi.logout(refreshToken)
  } finally {
    dispatch(clearSession())
  }
})
