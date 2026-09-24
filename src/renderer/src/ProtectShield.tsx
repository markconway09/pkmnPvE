interface Props {
  className?: string
}

// A translucent blue 16:9 panel over a Pokemon while a Protect-family move is
// up for the rest of the turn - offset a bit from center so it doesn't sit
// exactly on top of a screen panel (see SideScreens.tsx) when both are up.
function ProtectShield({ className }: Props): React.JSX.Element {
  return <div className={`${className ?? ''} protect-shield-rect`} />
}

export default ProtectShield
