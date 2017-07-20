import React from 'react';

const Button = ({className, onClick, disabled, children}) => (
    <button
        className={'btn' + (className ? ' ' + className : '')}
        onClick={onClick}
        disabled={disabled}
    >{children}</button>
);

Button.defaultProps = {
    disabled: false,
};

export default Button;