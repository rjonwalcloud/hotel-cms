import { useState, useEffect } from 'react';
import Modal from './Modal';

export default function PromptModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    placeholder = 'Enter value...',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    confirmColor = 'bg-blue-600 hover:bg-blue-700',
    required = true,
}) {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            setValue('');
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (required && !value.trim()) return;
        onConfirm(value.trim());
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <form onSubmit={handleSubmit}>
                <div className="text-gray-600 mb-4">{message}</div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm mb-6"
                    autoFocus
                />
                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        disabled={required && !value.trim()}
                        className={`px-4 py-2 border border-transparent rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmColor}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
