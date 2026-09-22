import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { photoOfProduct } from "@/lib/product-photos";
import { cn } from "@/lib/utils";

function fold(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
      <rect className="pi-bg" width="40" height="40" rx="10" fill="#f3efe8" />
      <ellipse cx="20" cy="34.6" rx="10" ry="1.7" fill="rgb(18 38 28 / 0.08)" />
      {children}
    </svg>
  );
}

const GLYPHS: { test: RegExp; node: ReactNode }[] = [
  {
    test: /caixa de papelao|papelao/,
    node: (
      <Tile>
        <path d="M8 16.5 20 11l12 5.5v14.2c0 .8-.6 1.3-1.3 1.3H9.3c-.7 0-1.3-.5-1.3-1.3V16.5z" fill="#c9a56a" />
        <path d="M8 16.5 20 21.2 32 16.5 20 11z" fill="#e4c894" />
        <path d="M20 21.2v15.8" stroke="#8d6a38" strokeWidth="1.1" opacity=".55" />
        <path d="M11 19.2h6" stroke="#fff" strokeWidth="1" opacity=".35" />
      </Tile>
    ),
  },
  {
    test: /maca|maç[aã]/,
    node: (
      <Tile>
        <defs>
          <radialGradient id="g-mac" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#f07a72" />
            <stop offset="100%" stopColor="#c2312b" />
          </radialGradient>
        </defs>
        <ellipse cx="20" cy="23" rx="9.2" ry="10.2" fill="url(#g-mac)" />
        <ellipse cx="16.2" cy="19.2" rx="2.6" ry="3.4" fill="#fff" opacity=".28" />
        <path d="M20 13.2c.2-3.4 2.8-5.2 4.4-4.4" stroke="#4a7a32" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M20 13.6c1.8-1.6 4.4-.4 4.6 1.6" fill="#3f8a3a" />
      </Tile>
    ),
  },
  {
    test: /\bpera\b/,
    node: (
      <Tile>
        <path d="M20 11.5c3.4 2.2 7.2 7.2 7.2 13.2A7.2 7.2 0 1 1 12.8 24.7C12.8 18.7 16.6 13.7 20 11.5z" fill="#c5d24e" />
        <path d="M20 11.5c2.2 1.5 4.8 5.2 5.6 9.4-1.6 1-4.2.8-6.4-.8 1.4-3.2 1.2-6.4.8-8.6z" fill="#dce86a" />
        <path d="M20 11.4c.1-2.6 2.2-3.8 3.4-3.2" stroke="#5a7a2a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </Tile>
    ),
  },
  {
    test: /uva/,
    node: (
      <Tile>
        <path d="M22 9.5c1.6 2.4 4.2 4.2 6.4 4.4" stroke="#3d7a32" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <circle cx="14.2" cy="22.4" r="3.5" fill="#6a2458" />
        <circle cx="20.2" cy="19.6" r="3.6" fill="#8a326e" />
        <circle cx="25.6" cy="23" r="3.4" fill="#7a2a68" />
        <circle cx="16.6" cy="27.2" r="3.3" fill="#5a1e4a" />
        <circle cx="22.6" cy="27.4" r="3.3" fill="#4a1840" />
        <circle cx="19.4" cy="23.6" r="3.2" fill="#9a3a7a" />
        <circle cx="18.2" cy="21.2" r="1" fill="#fff" opacity=".25" />
      </Tile>
    ),
  },
  {
    test: /kiwi/,
    node: (
      <Tile>
        <circle cx="20" cy="21.5" r="10" fill="#6a8f32" />
        <circle cx="20" cy="21.5" r="7.1" fill="#efe6b0" />
        <circle cx="20" cy="21.5" r="1.5" fill="#4a5e22" />
        <g fill="#6a4a18">
          <circle cx="20" cy="16.4" r=".55" />
          <circle cx="24.4" cy="19" r=".55" />
          <circle cx="23.6" cy="24.2" r=".55" />
          <circle cx="16.4" cy="24" r=".55" />
          <circle cx="15.6" cy="19.2" r=".55" />
        </g>
      </Tile>
    ),
  },
  {
    test: /caju/,
    node: (
      <Tile>
        <path d="M12.5 24.5c-.2-6 4.4-11 9.4-9.6 3.6 7.2-1.6 13.8-7.2 13.6-1.4 0-2.2-2.2-2.2-4z" fill="#e07a3d" />
        <path d="M17 22.5c1.6-2.4 4-3.2 6.2-2.2" stroke="#f0b07a" strokeWidth="1.2" fill="none" />
        <ellipse cx="25.4" cy="14.2" rx="5.1" ry="4.1" fill="#3d8a32" />
        <ellipse cx="24.2" cy="13.2" rx="1.5" ry="1.1" fill="#6aaa4a" />
      </Tile>
    ),
  },
  {
    test: /mamao|mam[aã]o|papaya/,
    node: (
      <Tile>
        <defs>
          <radialGradient id="g-pap" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffb04a" />
            <stop offset="100%" stopColor="#e06a14" />
          </radialGradient>
        </defs>
        <ellipse cx="20" cy="22" rx="8.2" ry="10.6" fill="url(#g-pap)" />
        <path d="M20 12.2v19.4" stroke="#f6d48a" strokeWidth="1.3" opacity=".7" />
        <circle cx="16.4" cy="21" r="1.05" fill="#6a3a12" />
        <circle cx="23.4" cy="23.4" r="1.05" fill="#6a3a12" />
        <circle cx="18.6" cy="26.2" r=".9" fill="#6a3a12" />
        <path d="M20 11.4c1.6-2.4 3.8-2.2 4.4-.6" stroke="#3d8a32" strokeWidth="1.3" fill="none" />
      </Tile>
    ),
  },
  {
    test: /manga/,
    node: (
      <Tile>
        <defs>
          <radialGradient id="g-man" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f0a03a" />
            <stop offset="100%" stopColor="#c45a14" />
          </radialGradient>
        </defs>
        <path d="M12.2 24c0-8.2 4.6-14 9.2-14s6.8 6.6 6.8 13.6-3.4 9.4-8 9.4-8-2.8-8-9z" fill="url(#g-man)" />
        <path d="M22.4 10.4c2.4-2.4 4.8-2.2 5.8.2" stroke="#3d7a32" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <ellipse cx="16.8" cy="20" rx="2.4" ry="3.6" fill="#fff" opacity=".18" />
      </Tile>
    ),
  },
  {
    test: /melanc/,
    node: (
      <Tile>
        <path d="M7 27.6a13.4 13.4 0 0 1 26 0H7z" fill="#2f8f4a" />
        <path d="M10.2 27.6a10.2 10.2 0 0 1 19.6 0H10.2z" fill="#e05656" />
        <path d="M13.2 27.6a7.2 7.2 0 0 1 13.6 0" stroke="#f4d48a" strokeWidth="1.1" fill="none" />
        <circle cx="17" cy="23.2" r=".7" fill="#3a2814" />
        <circle cx="21.4" cy="22.6" r=".7" fill="#3a2814" />
        <circle cx="19.4" cy="25.2" r=".65" fill="#3a2814" />
      </Tile>
    ),
  },
  {
    test: /melao|mel[aã]o/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="10.4" ry="9.2" fill="#efc43a" />
        <path d="M12.2 16.6c2.4 5 4.8 9.4 7.6 12.4M20 12.6c0 7 1.2 11.6 3.6 16.2M26.6 16.4c-1.6 5.4-2.2 9.6-1.2 13.2" stroke="#c49a20" strokeWidth="1.15" fill="none" />
        <ellipse cx="16" cy="18.4" rx="2.2" ry="1.6" fill="#fff" opacity=".22" />
      </Tile>
    ),
  },
  {
    test: /abacaxi/,
    node: (
      <Tile>
        <path d="M13.4 16.6h13.2l-1.3 15.2H14.7z" fill="#e6c04a" />
        <path d="M14.6 20.4h10.8M14.4 24.6h11.2M14.8 28.6h10.4" stroke="#c49a28" strokeWidth=".8" />
        <path d="M20 6.4 24.2 16H15.8z" fill="#3d8a32" />
        <path d="M13.6 8.2 20 14.6M26.4 8.2 20 14.6M16.4 6.6 20 13M23.6 6.6 20 13" stroke="#2f6a28" strokeWidth="1.15" />
      </Tile>
    ),
  },
  {
    test: /abacate/,
    node: (
      <Tile>
        <path d="M20 8.4c5.6 2.2 9 9 7.8 14.6-1.1 5.6-5.6 8-7.8 8s-6.7-2.4-7.8-8C11 17.4 14.4 10.6 20 8.4z" fill="#4a8a38" />
        <path d="M20 10.2c3.6 1.6 6 6.6 5.2 11.2" fill="none" stroke="#6aaa4a" strokeWidth="1.4" />
        <circle cx="20" cy="22.4" r="3.5" fill="#6b4a1a" />
        <circle cx="18.8" cy="21.2" r="1.1" fill="#8a6230" />
      </Tile>
    ),
  },
  {
    test: /laranj|ponkan|bergamota|tangerina/,
    node: (
      <Tile>
        <defs>
          <radialGradient id="g-lar" cx="36%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffb14a" />
            <stop offset="100%" stopColor="#e07010" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="22" r="9.4" fill="url(#g-lar)" />
        <circle cx="20" cy="22" r="9.4" fill="none" stroke="#d8680c" strokeWidth=".4" opacity=".4" />
        <path d="M20 13c1.4-3.4 3.6-3.6 4.6-2.2" stroke="#3d7a32" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="16.4" cy="19.2" r="1.6" fill="#fff" opacity=".22" />
      </Tile>
    ),
  },
  {
    test: /limao|lim[aã]o/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="9.2" ry="8" fill="#b4d034" />
        <ellipse cx="20" cy="22" rx="6.4" ry="5.4" fill="#c8e04a" opacity=".45" />
        <path d="M20 14.2c2.2-3.2 4.4-2.4 5.2-.8" stroke="#3d7a32" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <ellipse cx="16.2" cy="19.4" rx="1.8" ry="1.3" fill="#fff" opacity=".25" />
      </Tile>
    ),
  },
  {
    test: /morango/,
    node: (
      <Tile>
        <path d="M20 10.2c4.6 1.2 9.2 7 9.2 12.6-3.4 6-15 6-18.4 0C10.8 17.2 15.4 11.4 20 10.2z" fill="#e23b4a" />
        <path d="M14.2 10.4h11.6L20 15.4z" fill="#3d8a32" />
        <g fill="#fff" opacity=".85">
          <circle cx="16.4" cy="19.6" r=".55" />
          <circle cx="20.6" cy="18.4" r=".55" />
          <circle cx="23.6" cy="21.6" r=".55" />
          <circle cx="18" cy="23.6" r=".55" />
          <circle cx="22" cy="25.4" r=".55" />
        </g>
      </Tile>
    ),
  },
  {
    test: /maracuja|maracuj[aá]/,
    node: (
      <Tile>
        <circle cx="20" cy="21.4" r="9.4" fill="#c8a032" />
        <circle cx="20" cy="21.4" r="5.6" fill="#f4e8b0" />
        <circle cx="20" cy="21.4" r="1.6" fill="#6a4a12" />
        <g stroke="#c8a032" strokeWidth=".7" fill="none">
          <path d="M20 16.4v10M15.2 21.4h9.6M16.6 17.2l6.8 8.4M23.4 17.2l-6.8 8.4" />
        </g>
      </Tile>
    ),
  },
  {
    test: /aipim|mandioca|morcote/,
    node: (
      <Tile>
        <path d="M12.4 9.6c7 2.2 4.6 9.2 9.2 13.6s2.2 9-2.4 10.2c-6.8-1.2-9.2-8-6.8-13.6s-.2-9 .0-10.2z" fill="#e4c15a" />
        <path d="M14.6 12.2c4.8 2 3.6 7.2 7.2 11" stroke="#c4a040" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /alho/,
    node: (
      <Tile>
        <ellipse cx="20" cy="23.4" rx="9" ry="8" fill="#efe4c8" />
        <path d="M20 15.6v15.6M14.2 19.4c2.4 4.8 3.6 9.2 5.8 12.2M25.8 19.4c-2.4 4.8-3.6 9.2-5.8 12.2" stroke="#c8b888" strokeWidth="1.15" fill="none" />
        <path d="M17.6 13.4c.8-2.6 3.2-3.4 4.6-1.6" stroke="#c4b07a" strokeWidth="1.3" fill="none" />
      </Tile>
    ),
  },
  {
    test: /batata doce/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="11" ry="7.2" transform="rotate(-22 20 22)" fill="#d47a48" />
        <ellipse cx="17.4" cy="20.2" rx="2.2" ry="1.4" transform="rotate(-22 17.4 20.2)" fill="#e8a070" opacity=".7" />
      </Tile>
    ),
  },
  {
    test: /batata/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="10.4" ry="8.2" fill="#e0c07a" />
        <circle cx="16.2" cy="19.6" r="1.1" fill="#b8944a" />
        <circle cx="23.6" cy="24.2" r="1.1" fill="#b8944a" />
        <circle cx="21" cy="18.8" r=".8" fill="#b8944a" />
        <ellipse cx="16.6" cy="21.6" rx="2" ry="1.4" fill="#fff" opacity=".18" />
      </Tile>
    ),
  },
  {
    test: /cebola roxa/,
    node: (
      <Tile>
        <ellipse cx="20" cy="23.2" rx="9" ry="8" fill="#8a4a8a" />
        <path d="M20 15.4c0-3.4 2.4-5.6 3.6-5.4" stroke="#5a2a5a" strokeWidth="1.4" fill="none" />
        <path d="M14.8 22.2c2 4.6 3.4 8 5.2 10.4" stroke="#a66aa6" strokeWidth="1" fill="none" opacity=".6" />
      </Tile>
    ),
  },
  {
    test: /cebola/,
    node: (
      <Tile>
        <ellipse cx="20" cy="23.2" rx="9" ry="8" fill="#f0d9a0" />
        <path d="M20 15.4c0-3.4 2.4-5.6 3.6-5.4" stroke="#c4a060" strokeWidth="1.4" fill="none" />
        <path d="M14.8 22.2c2 4.6 3.4 8 5.2 10.4" stroke="#d8bc78" strokeWidth="1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /coco/,
    node: (
      <Tile>
        <circle cx="20" cy="22" r="9.4" fill="#6b4a2a" />
        <circle cx="20" cy="22" r="7.4" fill="#7a5634" />
        <circle cx="16.6" cy="19.6" r="1.25" fill="#3a2814" />
        <circle cx="22.8" cy="18.8" r="1.25" fill="#3a2814" />
        <circle cx="20.2" cy="24.2" r="1.25" fill="#3a2814" />
      </Tile>
    ),
  },
  {
    test: /ovo/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="7.6" ry="10.2" fill="#f6ead0" />
        <ellipse cx="17.4" cy="19" rx="2.4" ry="3.2" fill="#fff" opacity=".45" />
      </Tile>
    ),
  },
  {
    test: /brocol|br[oó]colis/,
    node: (
      <Tile>
        <rect x="18.1" y="22" width="3.8" height="9" rx="1.1" fill="#6aaa4a" />
        <circle cx="14.4" cy="17.2" r="5.4" fill="#2f8a3a" />
        <circle cx="25.2" cy="17.6" r="5.2" fill="#3d9a44" />
        <circle cx="20" cy="13.8" r="5.4" fill="#4aaa4e" />
        <circle cx="17.2" cy="20.2" r="3.6" fill="#368c3a" />
      </Tile>
    ),
  },
  {
    test: /abobrinha/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="4.6" ry="12.2" fill="#6aaa3a" />
        <ellipse cx="20" cy="22" rx="2.6" ry="10" fill="#8ec85a" opacity=".5" />
        <path d="M20 10.2c1.6-2 3.4-1.6 3.8.2" stroke="#3d7a32" strokeWidth="1.3" fill="none" />
      </Tile>
    ),
  },
  {
    test: /berinjela|beringela/,
    node: (
      <Tile>
        <ellipse cx="20" cy="23.4" rx="6.6" ry="9.8" fill="#5a3a78" />
        <path d="M16.2 12.2h7.6l-3.8 3.6z" fill="#3d8a32" />
        <ellipse cx="17.6" cy="20.4" rx="1.8" ry="2.6" fill="#fff" opacity=".16" />
      </Tile>
    ),
  },
  {
    test: /beterraba/,
    node: (
      <Tile>
        <circle cx="20" cy="23.6" r="8" fill="#a03248" />
        <path d="M20 16c-2.2-4.6 2.2-7 3.4-5.8M17.6 15.2c1.2-4.6 4.6-4.8 5.6-2.6" stroke="#3d8a32" strokeWidth="1.35" fill="none" />
        <circle cx="17.2" cy="21.8" r="1.5" fill="#fff" opacity=".16" />
      </Tile>
    ),
  },
  {
    test: /cenoura/,
    node: (
      <Tile>
        <path d="M20 33c-4.4-8.8-5.6-15.4-5.6-19.8h11.2C25.6 17.6 24.4 24.2 20 33z" fill="#e87820" />
        <path d="M14.4 10.6c2.4 2.2 4.6 2.2 9.2 0M16.6 8.2c1.2 2.2 3.4 2.2 4.6 0" stroke="#3d8a32" strokeWidth="1.4" fill="none" />
      </Tile>
    ),
  },
  {
    test: /chuchu/,
    node: (
      <Tile>
        <path d="M20 10c5.6 2.2 9 9 7.8 15.4-2.2 5.6-13.6 5.6-15.8 0C10.8 19 14.4 12.2 20 10z" fill="#8fbf6a" />
        <path d="M20 12.4c2.4 3.6 3.2 8.2 2.6 13" stroke="#6a9a48" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /gengibre/,
    node: (
      <Tile>
        <path d="M9.6 22c2.2-7 7-9.2 10.4-6.8 2.4 4.6 7 3.4 9.2 8-1.2 5.6-7 8-11.4 5.6-3.4 3.4-8 1.2-8.2-6.8z" fill="#d4b06a" />
        <path d="M16.2 18.4c2 3.2 5.2 4.4 8.4 3.2" stroke="#b89048" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /inhame|\byacon\b|\bcar[aá]\b/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="8" ry="11" fill="#c4b090" />
        <path d="M16.4 16.2c1.8 4.6 2.6 8.8 2.2 13" stroke="#a89470" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /jilo|jil[oó]/,
    node: (
      <Tile>
        <ellipse cx="20" cy="23.4" rx="6.6" ry="8.6" fill="#6a8a38" />
        <path d="M17.2 13h5.6l-2.8 3.4z" fill="#3d6a28" />
      </Tile>
    ),
  },
  {
    test: /milho/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="6.6" ry="11.2" fill="#f0c43a" />
        <path d="M14.8 16.6h10.4M14.8 21.2h10.4M14.8 25.8h10.4" stroke="#d4a020" strokeWidth="1" />
        <path d="M12.2 14.4c-2.6 4.2-2.2 10.4 0 14.2M27.8 14.4c2.6 4.2 2.2 10.4 0 14.2" stroke="#3d8a32" strokeWidth="1.5" fill="none" />
      </Tile>
    ),
  },
  {
    test: /pepino/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="5.4" ry="12" fill="#4a9a3a" />
        <ellipse cx="20" cy="22" rx="3" ry="9.4" fill="#6aba52" opacity=".45" />
        <path d="M18 14.4c1.4 4.8 1.6 9.6.6 14.2" stroke="#2f6a28" strokeWidth=".8" fill="none" opacity=".4" />
      </Tile>
    ),
  },
  {
    test: /piment[aã]o verde/,
    node: (
      <Tile>
        <path d="M12.2 16.8c0-4.4 15.6-4.4 15.6 0v9.2c0 4.6-3.4 6.8-7.8 6.8s-7.8-2.2-7.8-6.8z" fill="#3d8f32" />
        <path d="M20 12.6c0-3.4 3.4-3.4 3.4-1.1" stroke="#2f6a28" strokeWidth="1.5" fill="none" />
      </Tile>
    ),
  },
  {
    test: /pimentao|piment[aã]o/,
    node: (
      <Tile>
        <path d="M12.2 16.8c0-4.4 15.6-4.4 15.6 0v9.2c0 4.6-3.4 6.8-7.8 6.8s-7.8-2.2-7.8-6.8z" fill="#e0563a" />
        <path d="M20 12.6c0-3.4 3.4-3.4 3.4-1.1" stroke="#3d8a32" strokeWidth="1.5" fill="none" />
        <ellipse cx="16.6" cy="20.6" rx="1.8" ry="2.4" fill="#fff" opacity=".16" />
      </Tile>
    ),
  },
  {
    test: /quiabo/,
    node: (
      <Tile>
        <path d="M20 9.8c3.4 4.4 6.8 11.2 6.8 15.6a6.8 6.8 0 1 1-13.6 0c0-4.4 3.4-11.2 6.8-15.6z" fill="#5a9a38" />
        <path d="M20 14.2c1.6 4.2 2.4 8.2 2 12.4" stroke="#3d6a28" strokeWidth="1" fill="none" opacity=".5" />
      </Tile>
    ),
  },
  {
    test: /repolho roxo/,
    node: (
      <Tile>
        <circle cx="20" cy="22" r="10" fill="#6a3a78" />
        <circle cx="20" cy="22" r="6.2" fill="#8a5a98" />
        <path d="M14.2 18.4c2.6 2.2 6.8 2.2 9.6 0" stroke="#5a2a68" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /repolho/,
    node: (
      <Tile>
        <circle cx="20" cy="22" r="10" fill="#4a8a3a" />
        <circle cx="20" cy="22" r="6.2" fill="#6aaa4a" />
        <path d="M14.2 18.4c2.6 2.2 6.8 2.2 9.6 0" stroke="#2f6a28" strokeWidth="1.1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /tomate/,
    node: (
      <Tile>
        <circle cx="20" cy="22.4" r="9.2" fill="#d43a32" />
        <path d="M15.6 14.2c2.6 2.2 5.8 2.2 8.8 0" stroke="#3d8a32" strokeWidth="1.6" fill="none" />
        <circle cx="16.6" cy="19.8" r="1.7" fill="#fff" opacity=".2" />
      </Tile>
    ),
  },
  {
    test: /vagem/,
    node: (
      <Tile>
        <path d="M7.2 20.4c4.6-7 21.2-7 25.6 0-4.6 7-21.2 7-25.6 0z" fill="#6aaa3a" />
        <path d="M12.4 20.4h15.2" stroke="#4a8a28" strokeWidth="1" fill="none" />
      </Tile>
    ),
  },
  {
    test: /blueberry/,
    node: (
      <Tile>
        <circle cx="14.6" cy="22.6" r="5.6" fill="#3a4a8a" />
        <circle cx="24.4" cy="20.4" r="5.8" fill="#4a5a9a" />
        <circle cx="20.2" cy="27" r="4.8" fill="#2a3a6a" />
        <path d="M24.4 16.2v2.6M14.6 18.6v2.2" stroke="#d8c48a" strokeWidth="1.1" />
      </Tile>
    ),
  },
  {
    test: /cacau/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="6.8" ry="10.2" fill="#6b3a1a" />
        <path d="M16.4 16.2h7.2M15.8 21.4h8.4M16.4 26.4h7.2" stroke="#8a5230" strokeWidth="1" />
      </Tile>
    ),
  },
  {
    test: /carambola/,
    node: (
      <Tile>
        <path d="M20 8.2 23 16.4h8.6L25.2 21.6l2.6 8.2L20 24.8l-7.8 5-2.6-8.2-6.4-5.2H12z" fill="#e8c03a" />
      </Tile>
    ),
  },
  {
    test: /figo/,
    node: (
      <Tile>
        <path d="M20 10.2c6.8 3.4 9 11.2 6.8 16.6s-13.6 5.6-13.6 0 0-13.4 6.8-16.6z" fill="#6a3a5a" />
        <ellipse cx="17.6" cy="20" rx="1.8" ry="2.4" fill="#fff" opacity=".14" />
      </Tile>
    ),
  },
  {
    test: /graviola/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="9" ry="11" fill="#8fbf6a" />
        <circle cx="16.4" cy="19.2" r="1.2" fill="#5a8a3a" />
        <circle cx="23.2" cy="24.2" r="1.2" fill="#5a8a3a" />
        <circle cx="20.4" cy="16.6" r="1.1" fill="#5a8a3a" />
        <circle cx="18.2" cy="25.6" r="1.1" fill="#5a8a3a" />
      </Tile>
    ),
  },
  {
    test: /jabuticaba/,
    node: (
      <Tile>
        <circle cx="14.6" cy="22.4" r="5.6" fill="#3a2048" />
        <circle cx="24.4" cy="20.2" r="5.8" fill="#4a2a58" />
        <circle cx="20.2" cy="27" r="4.6" fill="#2a1438" />
        <circle cx="22.8" cy="18.4" r="1" fill="#fff" opacity=".18" />
      </Tile>
    ),
  },
  {
    test: /physalis|phishalys/,
    node: (
      <Tile>
        <path d="M20 9.6 29 19.2 20 32.4 11 19.2z" fill="#f0a020" />
        <circle cx="20" cy="20.2" r="3.4" fill="#e87820" />
      </Tile>
    ),
  },
  {
    test: /roma|rom[aã]/,
    node: (
      <Tile>
        <circle cx="20" cy="22.6" r="9" fill="#b0323a" />
        <path d="M16 12.4h8l-4 3.6z" fill="#8a242c" />
        <circle cx="17" cy="20.8" r="1.4" fill="#fff" opacity=".16" />
      </Tile>
    ),
  },
  {
    test: /tamara|t[aâ]mara/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="5.6" ry="11" fill="#6b3a18" />
        <ellipse cx="18.2" cy="18.6" rx="1.6" ry="2.4" fill="#8a5230" />
      </Tile>
    ),
  },
  {
    test: /tamarindo/,
    node: (
      <Tile>
        <path d="M9.4 20.4c4.6-9 16.6-9 21.2 0-4.6 9-16.6 9-21.2 0z" fill="#6a4a28" />
        <path d="M13.4 20.4h13.2" stroke="#8a6a40" strokeWidth="1.1" />
      </Tile>
    ),
  },
  {
    test: /tempero/,
    node: (
      <Tile>
        <path d="M12.2 27.2c0-9 15.6-9 15.6 0H12.2z" fill="#3d8a4a" />
        <path d="M17.2 12.4c0-3.4 5.6-3.4 5.6 0v10.4h-5.6z" fill="#2f6a38" />
      </Tile>
    ),
  },
  {
    test: /ameixa/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22.2" rx="8" ry="10" fill="#6a2a5a" />
        <path d="M20 12.4c2.2-2.2 4.6-2.2 4.6.2" stroke="#3d7a32" strokeWidth="1.4" fill="none" />
        <ellipse cx="17" cy="19.4" rx="1.8" ry="2.4" fill="#fff" opacity=".16" />
      </Tile>
    ),
  },
  {
    test: /goiaba/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22" rx="9" ry="10" fill="#d45a6a" />
        <circle cx="20" cy="22" r="3.6" fill="#f0c0c8" />
        <circle cx="20" cy="22" r="1.2" fill="#c44a58" />
      </Tile>
    ),
  },
  {
    test: /pessego|p[eê]ssego/,
    node: (
      <Tile>
        <circle cx="18.4" cy="22.2" r="9" fill="#f0905a" />
        <circle cx="23.2" cy="22.2" r="7.8" fill="#e87848" />
        <path d="M20 13c2.2-3.4 4.6-2.2 4.6.2" stroke="#3d8a32" strokeWidth="1.4" fill="none" />
      </Tile>
    ),
  },
  {
    test: /pitaya/,
    node: (
      <Tile>
        <ellipse cx="20" cy="22.4" rx="8" ry="10" fill="#e0567a" />
        <path d="M20 9.4 22.6 15l-2.6 2.2-2.6-2.2zM12.2 14.8l4.6 3.2-1.2 3.4-4.6-1.2zM27.8 14.8l-4.6 3.2 1.2 3.4 4.6-1.2z" fill="#3d8a32" />
        <g fill="#fff" opacity=".7">
          <circle cx="17.6" cy="23" r=".6" />
          <circle cx="22" cy="24.6" r=".6" />
          <circle cx="20" cy="21.4" r=".6" />
        </g>
      </Tile>
    ),
  },
];

const FALLBACK = (
  <Tile>
    <circle cx="20" cy="22.4" r="8" fill="#1b5c3e" />
    <path d="M20 11.6c2.2 2.2 3.4 4.4 3.4 6.6" stroke="#3d8a4a" strokeWidth="1.6" fill="none" />
    <ellipse cx="17.4" cy="20" rx="1.8" ry="2.2" fill="#fff" opacity=".18" />
  </Tile>
);

export function resolveProductGlyph(nome: string): ReactNode {
  const key = fold(nome);
  for (const row of GLYPHS) if (row.test.test(key)) return row.node;
  return FALLBACK;
}

export function ProductIcon({
  nome,
  codigo,
  size = "md",
  className,
}: {
  nome: string;
  codigo?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "xs" ? "h-8 w-8" : size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const photo = photoOfProduct(nome, codigo);
  if (photo) {
    return (
      <span className={cn("product-icon product-icon-photo inline-flex shrink-0 items-center justify-center overflow-visible bg-transparent p-0 shadow-none ring-0", box, className)} aria-hidden>
        <img src={photo} alt="" draggable={false} loading={size === "lg" ? "eager" : "lazy"} decoding="async" className="h-full w-full bg-transparent object-contain" />
      </span>
    );
  }
  const glyph = resolveProductGlyph(nome);
  return (
    <span className={cn("product-icon inline-flex shrink-0 overflow-hidden rounded-[10px] ring-1 ring-black/5", box, className)} aria-hidden>
      {isValidElement(glyph) ? cloneElement(glyph as ReactElement, { key: fold(nome) }) : glyph}
    </span>
  );
}

export function ProductLabel({
  nome,
  codigo,
  size = "sm",
  extra,
  className,
}: {
  nome: string;
  codigo?: string;
  size?: "sm" | "md" | "lg";
  extra?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <ProductIcon nome={nome} codigo={codigo} size={size} />
      <div className="min-w-0">
        {codigo ? <div className="truncate font-mono text-[11px] font-bold tabular-nums tracking-wide text-foreground">{codigo}</div> : null}
        <div className="truncate text-sm font-normal leading-tight text-foreground/85">{nome}</div>
        {extra ? <div className="truncate text-[11px] text-muted-foreground">{extra}</div> : null}
      </div>
    </div>
  );
}
