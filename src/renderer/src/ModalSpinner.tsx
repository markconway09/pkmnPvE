/**
 * What a window shows while its contents load: a spinner filling the space they'll take.
 * The window itself is given its loaded size meanwhile (a `modal-panel-loading` class on
 * it - see the sizes in styles.css), so it opens at its full height rather than growing
 * into it once everything arrives.
 */
function ModalSpinner(): React.JSX.Element {
  return (
    <div className="modal-spinner" role="status" aria-label="Loading">
      <span className="modal-spinner-ring" />
    </div>
  )
}

export default ModalSpinner
