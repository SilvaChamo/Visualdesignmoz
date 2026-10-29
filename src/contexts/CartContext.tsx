'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CartItem = {
  id: string;
  type: 'domain' | 'hosting' | 'ssl' | 'email';
  name: string;
  price: number;
  period: number; // in years
  renewPrice?: number;
  /** Só presente numa transferência de domínio (não um registo novo) — código EPP. */
  authCode?: string;
  /** #6: domínio a que esta hospedagem se destina — nunca derivar do `name`
   * (nome comercial do plano, ex. "Alojamento Web Básico"), que não é um
   * domínio válido e faz a activação no DirectAdmin falhar sempre. Pedido no
   * checkout antes de deixar pagar. */
  hostingDomain?: string;
  /** Hospedagem: nome de utilizador da conta de hospedagem (cada hospedagem tem a sua conta no servidor). */
  contaUtilizador?: string;
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  /** Muda o período (anos) de um item já no carrinho — usado pelo selector de
   * anos de domínios no carrinho/checkout. O preço vem já recalculado por
   * quem chama (ver domainRegistrationPriceMt), nunca recalculado aqui. */
  updateItemPeriod: (id: string, period: number, price: number) => void;
  /** #6: define o domínio de destino de um item de hospedagem já no carrinho. */
  updateItemHostingDomain: (id: string, hostingDomain: string) => void;
  /** Hospedagem: define o nome de utilizador da conta de hospedagem. */
  updateItemContaUtilizador: (id: string, contaUtilizador: string) => void;
  clearCart: () => void;
  total: number;
  /** O carrinho guardado no navegador já foi lido (antes disso `items` vem vazio e não quer dizer «carrinho vazio»). */
  ready: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Load from local storage on init
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vd_cart');
      if (saved) {
        let lidos: CartItem[] = JSON.parse(saved);
        // Uma versão anterior propunha um nome de utilizador a partir do domínio e guardava-o no carrinho: limpa-se uma só vez,
        // para o campo abrir vazio. Depois disto só fica o que a pessoa escrever.
        if (!localStorage.getItem('vd_cart_conta_limpa')) {
          lidos = lidos.map((i) => (i.contaUtilizador ? { ...i, contaUtilizador: '' } : i));
          localStorage.setItem('vd_cart', JSON.stringify(lidos));
        }
        setItems(lidos);
      }
      localStorage.setItem('vd_cart_conta_limpa', '1');
    } catch (e) {
      console.error("Failed to load cart from local storage", e);
    }
    setReady(true);
  }, []);

  // Save to local storage on change
  useEffect(() => {
    // antes de ler o carrinho guardado, `items` é [] — gravar agora apagava o carrinho de quem recarrega a página
    if (!ready) return;
    localStorage.setItem('vd_cart', JSON.stringify(items));
  }, [items, ready]);

  const addItem = (item: CartItem) => {
    // CORRIGIDO (14 ago 2026) — chegou a bloquear-se aqui por engano. Esta
    // pasta é o Contabo/Hestia, que NÃO tem o limite de contas do
    // DirectAdmin (Hetzner) — é exactamente por isso que a compra de
    // hospedagem deve continuar activa aqui. Se algum dia se quiser
    // pausar a venda de hospedagem, é no site em produção (Hetzner,
    // pasta ../visualdesign) que isso faz sentido, nunca aqui.
    setItems((prev) => {
      // Prevent duplicates based on name/type
      if (prev.find(i => i.name === item.name && i.type === item.type)) {
        return prev;
      }
      return [...prev, item];
    });
    // Removed setIsCartOpen(true) to keep user on the page
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter(item => item.id !== id));
  };

  const updateItemPeriod = (id: string, period: number, price: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, period, price } : item)));
  };

  const updateItemHostingDomain = (id: string, hostingDomain: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, hostingDomain } : item)));
  };

  const updateItemContaUtilizador = (id: string, contaUtilizador: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, contaUtilizador } : item)));
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = items.reduce((acc, item) => acc + item.price, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateItemPeriod, updateItemHostingDomain, updateItemContaUtilizador, clearCart, total, ready, isCartOpen, setIsCartOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
