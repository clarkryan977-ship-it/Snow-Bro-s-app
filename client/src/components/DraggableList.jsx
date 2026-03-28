import { useState } from 'react';

export default function DraggableList({ items, onReorder, renderItem }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [list, setList] = useState(items);

  const handleDragStart = (index) => {
    setDraggedItem(index);
  };

  const handleDragOver = (index) => {
    setDragOverItem(index);
  };

  const handleDrop = () => {
    if (draggedItem === null || dragOverItem === null || draggedItem === dragOverItem) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newList = [...list];
    const draggedItemContent = newList[draggedItem];
    newList.splice(draggedItem, 1);
    newList.splice(dragOverItem, 0, draggedItemContent);

    setList(newList);
    onReorder(newList);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  return (
    <div>
      {list.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={() => handleDragOver(index)}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          style={{
            opacity: draggedItem === index ? 0.5 : 1,
            background: dragOverItem === index ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            transition: 'background 0.2s ease',
            cursor: 'grab'
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}
