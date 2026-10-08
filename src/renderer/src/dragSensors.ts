import { PointerSensor, TouchSensor, useSensor, useSensors, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core'
import { IS_MOBILE } from './platform'

/**
 * How a drag starts (the box to the team, a team's order...). With a mouse, once the
 * pointer has moved a little. On a phone a finger has to rest on the Pokemon a moment
 * first - a quick swipe still scrolls the page.
 */
export function useDragSensors(): SensorDescriptor<SensorOptions>[] {
  const sensor = useSensor(
    IS_MOBILE ? TouchSensor : PointerSensor,
    IS_MOBILE ? { activationConstraint: { delay: 250, tolerance: 8 } } : { activationConstraint: { distance: 8 } }
  )
  return useSensors(sensor)
}
