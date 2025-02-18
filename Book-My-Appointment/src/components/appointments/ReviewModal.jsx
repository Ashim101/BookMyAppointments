import { useState } from 'react'
import { toast } from 'react-toastify'
import { reviewAppointment } from '../../api/appointments'
import { useAction } from '../../hooks/useQuery'
import { errorMessage } from '../../lib/errors'
import { validateReview } from '../../lib/validation'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import StarRating from '../ui/StarRating'
import Textarea from '../ui/Textarea'

export default function ReviewModal({ appointment, open, onClose, onReviewed }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState({})
  const review = useAction(reviewAppointment)

  const submit = async (event) => {
    event.preventDefault()
    const found = validateReview({ rating, comment })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const updated = await review.run(appointment.id, { rating, comment: comment.trim() })
      toast.success('Thanks for your feedback!')
      onReviewed(updated)
    } catch (err) {
      toast.error(errorMessage(err))
      if (err.code === 'ALREADY_REVIEWED') onClose()
    }
  }

  if (!appointment) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review ${appointment.doctor.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={review.loading}>
            Not now
          </Button>
          <Button type="submit" form="review-form" loading={review.loading}>
            Submit review
          </Button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="space-y-4" noValidate>
        <StarRating value={rating} onChange={setRating} label="How was your visit?" error={errors.rating} />
        <Textarea
          label="Comments (optional)"
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={errors.comment}
        />
      </form>
    </Modal>
  )
}
