"use client"
import {
    Input
} from '@/components/ui/input'
import {
    Button
} from '@/components/ui/button'
import {
    ArrowUp
} from 'lucide-react'

interface ChatInputProps {
    input: string;
    handleInputChange: (e: any) => void;
    handleSubmit: (e: any) => void;
}

// const ChatInput:React.FC<ChatInputProps>
export default function ChatInput({
    input,
    handleInputChange,
    handleSubmit,
}: ChatInputProps) {
    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
                onChange={handleInputChange}
                value={input}
                placeholder="比如：糖尿病患者适合吃什么菜？有什么营养搭配建议？"
            />
            <Button>
                <ArrowUp />
                <span className="sr-only">Sumbit</span>
            </Button>
        </form>
    )
}

