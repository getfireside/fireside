import React from 'react';
import FormsyReactComponent from 'formsy-react-components/release/hoc/component';
import RadioGroup from 'formsy-react-components/release/components/radio-group';

export class RadioButtonGroup extends RadioGroup {
    renderElement = () => {
        const controls = this.props.options.map((radio, key) => {
            let checked = (this.props.value === radio.value);
            let disabled = radio.disabled || this.props.disabled;
            let className = 'radio btn btn-radio' + (
                disabled ? ' btn-disabled' : ''
            ) + (
                checked ? ' btn-checked' : ''
            );
            return (
                <div className={className} key={key}>
                    <label className={"radio-" + radio.value} tabIndex="0">
                        <input
                            ref={(input) => { this.elements[radio.value] = input }}
                            checked={checked}
                            type="radio"
                            value={radio.value}
                            onChange={this.handleChange}
                            disabled={disabled}
                        /> {radio.label}
                    </label>
                </div>
            );
        });
        return <div className="buttons">{controls}</div>;
    }
}

export default FormsyReactComponent(RadioButtonGroup);

RadioButtonGroup.defaultProps = RadioGroup.defaultProps;