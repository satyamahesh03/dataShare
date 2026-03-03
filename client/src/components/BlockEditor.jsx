import { useState, useRef, useEffect, useCallback } from 'react';
import { FiType, FiCheckSquare, FiList, FiHash } from 'react-icons/fi';

const BLOCK_TYPES = [
    { type: 'text', label: 'Text', desc: 'Just start typing with plain text.', icon: '¶' },
    { type: 'todo', label: 'To-do List', desc: 'Track tasks with a to-do list.', icon: '☑' },
    { type: 'h1', label: 'Heading 1', desc: 'Big section heading.', icon: 'H₁' },
    { type: 'h2', label: 'Heading 2', desc: 'Medium section heading.', icon: 'H₂' },
    { type: 'h3', label: 'Heading 3', desc: 'Small section heading.', icon: 'H₃' },
    { type: 'bullet', label: 'Bullet List', desc: 'Create a simple bullet list.', icon: '•' },
    { type: 'numbered', label: 'Numbered List', desc: 'Create a list with numbering.', icon: '1.' },
];

function createBlock(type = 'text', content = '') {
    return { id: Date.now() + Math.random(), type, content, checked: false };
}

export default function BlockEditor({ onContentChange }) {
    const [blocks, setBlocks] = useState([createBlock()]);
    const [slashMenu, setSlashMenu] = useState(null); // { blockIndex, filter }
    const [slashFilter, setSlashFilter] = useState('');
    const [selectedMenuItem, setSelectedMenuItem] = useState(0);
    const blockRefs = useRef({});
    const menuRef = useRef(null);

    // Serialize blocks to text for saving
    useEffect(() => {
        const text = blocks.map((block, i) => {
            const content = block.content || '';
            switch (block.type) {
                case 'h1': return `# ${content}`;
                case 'h2': return `## ${content}`;
                case 'h3': return `### ${content}`;
                case 'bullet': return `• ${content}`;
                case 'numbered': return `${i + 1}. ${content}`;
                case 'todo': return `${block.checked ? '☑' : '☐'} ${content}`;
                default: return content;
            }
        }).join('\n');
        onContentChange(text);
    }, [blocks]);

    const updateBlock = (index, updates) => {
        setBlocks(prev => {
            const newBlocks = [...prev];
            newBlocks[index] = { ...newBlocks[index], ...updates };
            return newBlocks;
        });
    };

    const focusBlock = (blockId, toEnd = true) => {
        setTimeout(() => {
            const el = blockRefs.current[blockId];
            if (el) {
                el.focus();
                if (toEnd && el.textContent) {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }, 10);
    };

    const handleInput = (index, e) => {
        const content = e.target.textContent;
        updateBlock(index, { content });

        // Detect slash command
        if (content === '/') {
            const rect = e.target.getBoundingClientRect();
            setSlashMenu({ blockIndex: index, top: rect.bottom + 8, left: rect.left });
            setSlashFilter('');
            setSelectedMenuItem(0);
        } else if (content.startsWith('/') && slashMenu?.blockIndex === index) {
            setSlashFilter(content.slice(1).toLowerCase());
            setSelectedMenuItem(0);
        } else if (slashMenu?.blockIndex === index) {
            setSlashMenu(null);
        }
    };

    const handleKeyDown = (index, e) => {
        const block = blocks[index];

        // Slash menu navigation
        if (slashMenu) {
            const filtered = getFilteredTypes();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMenuItem(prev => Math.min(prev + 1, filtered.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMenuItem(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[selectedMenuItem]) {
                    selectSlashCommand(filtered[selectedMenuItem].type);
                }
                return;
            }
            if (e.key === 'Escape') {
                setSlashMenu(null);
                return;
            }
        }

        // Enter: create new block
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const newType = ['bullet', 'numbered', 'todo'].includes(block.type) ? block.type : 'text';
            const newBlock = createBlock(newType);
            setBlocks(prev => {
                const newBlocks = [...prev];
                newBlocks.splice(index + 1, 0, newBlock);
                return newBlocks;
            });
            focusBlock(newBlock.id);
        }

        // Backspace on empty block: remove & merge up
        if (e.key === 'Backspace' && !block.content && blocks.length > 1) {
            e.preventDefault();
            if (block.type !== 'text') {
                // First convert back to text
                updateBlock(index, { type: 'text' });
            } else {
                // Remove block and focus previous
                setBlocks(prev => prev.filter((_, i) => i !== index));
                if (index > 0) {
                    focusBlock(blocks[index - 1].id, true);
                }
            }
        }

        // Arrow up/down to navigate blocks
        if (e.key === 'ArrowUp' && index > 0) {
            const sel = window.getSelection();
            if (sel.anchorOffset === 0) {
                e.preventDefault();
                focusBlock(blocks[index - 1].id, true);
            }
        }
        if (e.key === 'ArrowDown' && index < blocks.length - 1) {
            const sel = window.getSelection();
            const el = blockRefs.current[block.id];
            if (el && sel.anchorOffset >= (el.textContent?.length || 0)) {
                e.preventDefault();
                focusBlock(blocks[index + 1].id, false);
            }
        }
    };

    const selectSlashCommand = (type) => {
        const index = slashMenu.blockIndex;
        updateBlock(index, { type, content: '' });
        setSlashMenu(null);

        // Clear and focus the block
        const el = blockRefs.current[blocks[index].id];
        if (el) {
            el.textContent = '';
            el.focus();
        }
    };

    const getFilteredTypes = () => {
        if (!slashFilter) return BLOCK_TYPES;
        return BLOCK_TYPES.filter(t =>
            t.label.toLowerCase().includes(slashFilter) ||
            t.type.toLowerCase().includes(slashFilter)
        );
    };

    const toggleTodo = (index) => {
        updateBlock(index, { checked: !blocks[index].checked });
    };

    const getPlaceholder = (block, index) => {
        if (index === 0 && blocks.length === 1) return 'Type / for commands...';
        switch (block.type) {
            case 'h1': return 'Heading 1';
            case 'h2': return 'Heading 2';
            case 'h3': return 'Heading 3';
            case 'bullet': return 'List item';
            case 'numbered': return 'List item';
            case 'todo': return 'To-do';
            default: return 'Type / for commands...';
        }
    };

    const getNumberedIndex = (index) => {
        let count = 1;
        for (let i = index - 1; i >= 0; i--) {
            if (blocks[i].type === 'numbered') count++;
            else break;
        }
        return count;
    };

    return (
        <div className="block-editor">
            {blocks.map((block, index) => (
                <div key={block.id} className={`block-row block-${block.type}`}>
                    {/* Block prefix */}
                    {block.type === 'bullet' && (
                        <span className="block-prefix bullet-prefix">•</span>
                    )}
                    {block.type === 'numbered' && (
                        <span className="block-prefix numbered-prefix">{getNumberedIndex(index)}.</span>
                    )}
                    {block.type === 'todo' && (
                        <span
                            className={`block-prefix todo-checkbox ${block.checked ? 'checked' : ''}`}
                            onClick={() => toggleTodo(index)}
                        >
                            {block.checked ? '☑' : '☐'}
                        </span>
                    )}

                    {/* Content editable */}
                    <div
                        ref={el => blockRefs.current[block.id] = el}
                        className={`block-content ${block.type === 'todo' && block.checked ? 'checked' : ''}`}
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder={getPlaceholder(block, index)}
                        onInput={e => handleInput(index, e)}
                        onKeyDown={e => handleKeyDown(index, e)}
                        onFocus={() => {
                            if (slashMenu && slashMenu.blockIndex !== index) setSlashMenu(null);
                        }}
                    />
                </div>
            ))}

            {/* Slash command menu */}
            {slashMenu && (
                <div
                    className="slash-menu"
                    ref={menuRef}
                    style={{ top: slashMenu.top, left: slashMenu.left }}
                >
                    <div className="slash-menu-inner">
                        {getFilteredTypes().map((item, i) => (
                            <button
                                key={item.type}
                                className={`slash-menu-item ${i === selectedMenuItem ? 'active' : ''}`}
                                onMouseDown={e => {
                                    e.preventDefault();
                                    selectSlashCommand(item.type);
                                }}
                                onMouseEnter={() => setSelectedMenuItem(i)}
                            >
                                <span className="slash-menu-icon">{item.icon}</span>
                                <div className="slash-menu-text">
                                    <span className="slash-menu-label">{item.label}</span>
                                    <span className="slash-menu-desc">{item.desc}</span>
                                </div>
                            </button>
                        ))}
                        {getFilteredTypes().length === 0 && (
                            <div className="slash-menu-empty">No results</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
