/** Horde mode's icon: one Poke Ball holding off a crowd, drawn on the same 24x24
    pixel grid as the Battles icon so it sits with the pixel-art nav icons. */
function HordeIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 6h4v1H5zM3 7h8v1H3zM2 8h3v1H2zM9 8h3v1H9zM2 9h2v1H2zM10 9h2v1h-2zM1 10h2v1H1zM5 10h4v1H5zM11 10h2v1h-2zM1 11h12v2H1zM1 13h2v1H1zM5 13h4v1H5zM11 13h2v1h-2zM2 14h2v1H2zM10 14h2v1h-2zM2 15h3v1H2zM9 15h3v1H9zM3 16h8v1H3zM5 17h4v1H5z"
      />
      <path
        fill="currentColor"
        opacity="0.9"
        d="M15 4h3v1h-3zM14 5h5v2h-5zM15 7h3v1h-3zM15 16h3v1h-3zM14 17h5v2h-5zM15 19h3v1h-3z"
      />
      <path fill="currentColor" opacity="0.75" d="M19 10h3v1h-3zM18 11h5v2h-5zM19 13h3v1h-3z" />
      <path fill="currentColor" opacity="0.5" d="M21 2h1v1h-1zM20 3h3v2h-3zM20 19h3v2h-3zM21 21h1v1h-1z" />
    </svg>
  )
}

export default HordeIcon
