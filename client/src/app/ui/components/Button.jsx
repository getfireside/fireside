import React from 'react';

const Button = ({className, type, onClick, disabled, children, ...props}) => (
    <button
        className={'btn' + (className ? ' ' + className : '')}
        onClick={onClick}
        disabled={disabled}
        type={type}
        {...props}
    >{children}</button>
);

Button.defaultProps = {
    disabled: false,
};

export default Button;