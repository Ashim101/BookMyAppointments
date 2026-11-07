import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import * as notificationsApi from '../../api/notifications'
import { clearSession } from '../auth/authSlice'

const RECENT_LIMIT = 6

export const fetchRecent = createAsyncThunk('notifications/fetchRecent', () =>
  notificationsApi.listNotifications({ limit: RECENT_LIMIT }),
)
export const readOne = createAsyncThunk('notifications/readOne', (id) => notificationsApi.markRead(id))
export const readAll = createAsyncThunk('notifications/readAll', () => notificationsApi.markAllRead())

const initialState = { items: [], unreadCount: 0, loaded: false }

const slice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    unreadCountChanged(state, { payload }) {
      state.unreadCount = payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecent.fulfilled, (state, { payload }) => {
        state.items = payload.items
        state.unreadCount = payload.unreadCount
        state.loaded = true
      })
      .addCase(readOne.fulfilled, (state, { payload }) => {
        const target = state.items.find((n) => n.id === payload.id)
        if (target && !target.read) state.unreadCount = Math.max(0, state.unreadCount - 1)
        if (target) target.read = true
      })
      .addCase(readAll.fulfilled, (state) => {
        state.items.forEach((n) => {
          n.read = true
        })
        state.unreadCount = 0
      })
      .addCase(clearSession, () => initialState)
  },
})

export const { unreadCountChanged } = slice.actions
export default slice.reducer
