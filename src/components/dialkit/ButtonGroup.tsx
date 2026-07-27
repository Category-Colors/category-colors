interface ButtonGroupProps {
  buttons: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
}

export function ButtonGroup({ buttons }: ButtonGroupProps) {
  return (
    <div className="dialkit-button-group">
      {buttons.map((button, index) => (
        <button
          key={index}
          className="dialkit-button"
          onClick={button.onClick}
          disabled={button.disabled}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
